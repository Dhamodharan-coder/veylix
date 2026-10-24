"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import {
  VaultAccessError,
  atLeast,
  getItemPermission,
  requireFolderPermission,
  requireItemPermission,
  requireVaultUser,
} from "@/lib/vault-access";
import { CLIENT_ACCESS_ACTIONS, VAULT_ACTIONS, logVaultEvent } from "@/lib/vault-audit";
import { RateLimitError, enforce } from "@/lib/rate-limit";
import type { VaultPermission } from "@/generated/prisma/client";

/** Refreshes the open page after a change. A no-op when an action is reused by an
 * API route (e.g. the browser extension), where Next.js doesn't allow refresh(). */
function revalidate() {
  try {
    refresh();
  } catch {
    // Not inside a Server Action.
  }
}

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Turns access/validation failures into `{ ok: false, error }` for the UI. */
async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof VaultAccessError) return { ok: false, error: e.message };
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    throw e;
  }
}

// ---------- validation ----------

const cipher = z.string().max(200_000).regex(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/, "Invalid ciphertext");
const sealed = z.string().max(2_000).regex(/^r1\.[A-Za-z0-9+/=]+$/, "Invalid key");
const b64 = z.string().max(4_000).regex(/^[A-Za-z0-9+/=]+$/);
const name = z.string().trim().min(1, "Name is required").max(100, "Name is too long (max 100)");
const shareable = z.enum(["MANAGE", "MODIFY", "VIEW"]);
const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const itemFields = z.object({
  name,
  url: z
    .string()
    .trim()
    .max(2_000)
    .transform((v) => (v === "" ? null : /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`))
    .nullable(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).transform((t) => [...new Set(t)]),
  encryptedData: cipher,
});

// ---------- account ----------

export async function createVaultAccount(input: {
  kdfSalt: string;
  kdfIterations: number;
  publicKey: string;
  encryptedPrivateKey: string;
  personalFolderKey: string;
  recoveryWrappedPrivateKey: string;
}) {
  return run(async () => {
    const user = await requireUser();
    const data = z
      .object({
        kdfSalt: b64,
        kdfIterations: z.number().int().min(100_000).max(10_000_000),
        publicKey: b64,
        encryptedPrivateKey: cipher,
        personalFolderKey: sealed,
        recoveryWrappedPrivateKey: cipher,
      })
      .parse(input);

    if (await prisma.vaultAccount.findUnique({ where: { userId: user.id } })) throw new VaultAccessError("Your vault is already set up.");

    await prisma.$transaction(async (tx) => {
      await tx.vaultAccount.create({
        data: {
          userId: user.id,
          kdfSalt: data.kdfSalt,
          kdfIterations: data.kdfIterations,
          publicKey: data.publicKey,
          encryptedPrivateKey: data.encryptedPrivateKey,
          recoveryWrappedPrivateKey: data.recoveryWrappedPrivateKey,
          recoveryCreatedAt: new Date(),
        },
      });
      await tx.vaultFolder.create({
        data: {
          name: "My Vault",
          isPersonal: true,
          ownerId: user.id,
          members: { create: { userId: user.id, permission: "OWNER", encryptedFolderKey: data.personalFolderKey, addedById: user.id } },
        },
      });

      // Shares sent to this email before the user had a vault become "awaiting access".
      const invites = await tx.vaultInvite.findMany({ where: { email: user.email.toLowerCase() } });
      for (const inv of invites) {
        if (inv.folderId) {
          await tx.vaultFolderMember.upsert({
            where: { folderId_userId: { folderId: inv.folderId, userId: user.id } },
            create: { folderId: inv.folderId, userId: user.id, permission: inv.permission, addedById: inv.invitedById },
            update: {},
          });
        } else if (inv.itemId) {
          await tx.vaultItemShare.upsert({
            where: { itemId_userId: { itemId: inv.itemId, userId: user.id } },
            create: { itemId: inv.itemId, userId: user.id, permission: inv.permission, sharedById: inv.invitedById },
            update: {},
          });
        }
      }
      await tx.vaultInvite.deleteMany({ where: { email: user.email.toLowerCase() } });
    });

    await logVaultEvent(user.id, "VAULT_CREATED");
    // No refresh here: the browser shows the recovery key first, then refreshes.
    return {};
  });
}

export async function changeMasterPassword(input: { kdfSalt: string; kdfIterations: number; encryptedPrivateKey: string }) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultKeyChange", user.id);
    const data = z.object({ kdfSalt: b64, kdfIterations: z.number().int().min(100_000).max(10_000_000), encryptedPrivateKey: cipher }).parse(input);
    await prisma.vaultAccount.update({ where: { userId: user.id }, data });
    await logVaultEvent(user.id, "MASTER_PASSWORD_CHANGED");
    return {};
  });
}

/** Store a (new) recovery-key copy of the private key. Replaces any previous one. */
export async function setRecoveryKey(recoveryWrappedPrivateKey: string) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultKeyChange", user.id);
    await prisma.vaultAccount.update({
      where: { userId: user.id },
      data: { recoveryWrappedPrivateKey: cipher.parse(recoveryWrappedPrivateKey), recoveryCreatedAt: new Date() },
    });
    await logVaultEvent(user.id, "RECOVERY_KEY_CREATED");
    revalidate();
    return {};
  });
}

/**
 * Forgot master password, with a recovery key: the browser opened the private
 * key with the recovery key and re-sealed it under a new master password and a
 * new recovery key (the old one is used up). No data is lost.
 */
export async function recoverVault(input: { kdfSalt: string; kdfIterations: number; encryptedPrivateKey: string; recoveryWrappedPrivateKey: string }) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultKeyChange", user.id);
    const data = z
      .object({ kdfSalt: b64, kdfIterations: z.number().int().min(100_000).max(10_000_000), encryptedPrivateKey: cipher, recoveryWrappedPrivateKey: cipher })
      .parse(input);
    await prisma.vaultAccount.update({ where: { userId: user.id }, data: { ...data, recoveryCreatedAt: new Date() } });
    await logVaultEvent(user.id, "VAULT_RECOVERED");
    return {};
  });
}

/**
 * Forgot master password, no recovery key: delete the user's own vault data so
 * they can start over. Access to folders/passwords others shared with them is
 * kept but reset to "awaiting access", so sharers re-grant it automatically to
 * the new key pair. Requires the account password (or email for OAuth-only users).
 */
export async function resetVault(confirmation: { password?: string; email?: string }) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultReset", user.id);
    const hasPassword = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } });
    if (hasPassword) {
      try {
        await auth.api.verifyPassword({ body: { password: z.string().min(1).parse(confirmation.password) }, headers: await headers() });
      } catch {
        throw new VaultAccessError("That password is incorrect.");
      }
    } else if (confirmation.email?.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new VaultAccessError("Type your account email exactly to confirm.");
    }

    await prisma.$transaction([
      prisma.vaultFolder.deleteMany({ where: { ownerId: user.id } }),
      prisma.vaultFolderMember.updateMany({ where: { userId: user.id }, data: { encryptedFolderKey: null } }),
      prisma.vaultItemShare.updateMany({ where: { userId: user.id }, data: { encryptedItemKey: null } }),
      prisma.vaultAccount.delete({ where: { userId: user.id } }),
    ]);
    await logVaultEvent(user.id, "VAULT_RESET");
    revalidate();
    return {};
  });
}

export async function updateAutoLock(minutes: number) {
  return run(async () => {
    const user = await requireVaultUser();
    const value = z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60), z.literal(240)]).parse(minutes);
    await prisma.vaultAccount.update({ where: { userId: user.id }, data: { autoLockMinutes: value } });
    revalidate();
    return {};
  });
}

/** Events that only the browser knows about (decryption happens client-side). */
export async function logVaultAccess(action: (typeof CLIENT_ACCESS_ACTIONS)[number], itemId?: string) {
  return run(async () => {
    const parsed = z.enum(CLIENT_ACCESS_ACTIONS).parse(action);
    if (itemId) {
      const { user, item } = await requireItemPermission(itemId, "VIEW");
      await enforce("vaultAccessLog", user.id);
      await logVaultEvent(user.id, parsed, { itemId, folderId: item.folderId, targetName: item.name });
    } else {
      await logVaultEvent((await requireVaultUser()).id, parsed);
    }
    return {};
  });
}

// ---------- folders ----------

export async function createFolder(input: { name: string; encryptedFolderKey: string }) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultWrite", user.id);
    const data = z.object({ name, encryptedFolderKey: sealed }).parse(input);
    const folder = await prisma.vaultFolder.create({
      data: {
        name: data.name,
        ownerId: user.id,
        members: { create: { userId: user.id, permission: "OWNER", encryptedFolderKey: data.encryptedFolderKey, addedById: user.id } },
      },
    });
    await logVaultEvent(user.id, "FOLDER_CREATED", { folderId: folder.id, targetName: folder.name });
    revalidate();
    return { folderId: folder.id };
  });
}

export async function renameFolder(folderId: string, newName: string) {
  return run(async () => {
    const { user, folder } = await requireFolderPermission(folderId, "MANAGE");
    await enforce("vaultWrite", user.id);
    if (folder.isPersonal) throw new VaultAccessError("Your personal vault can't be renamed.");
    const parsed = name.parse(newName);
    await prisma.vaultFolder.update({ where: { id: folderId }, data: { name: parsed } });
    await logVaultEvent(user.id, "FOLDER_RENAMED", { folderId, targetName: parsed, metadata: { from: folder.name } });
    revalidate();
    return {};
  });
}

export async function deleteFolder(folderId: string) {
  return run(async () => {
    const { user, folder } = await requireFolderPermission(folderId, "OWNER");
    await enforce("vaultWrite", user.id);
    if (folder.isPersonal) throw new VaultAccessError("Your personal vault can't be deleted.");
    await logVaultEvent(user.id, "FOLDER_DELETED", { folderId, targetName: folder.name });
    await prisma.vaultFolder.delete({ where: { id: folderId } });
    revalidate();
    return {};
  });
}

// ---------- items ----------

export async function createItem(input: {
  folderId: string;
  type: "LOGIN" | "SECURE_NOTE";
  name: string;
  url: string | null;
  tags: string[];
  encryptedItemKey: string;
  encryptedData: string;
}) {
  return run(async () => {
    const data = itemFields.extend({ folderId: z.string(), type: z.enum(["LOGIN", "SECURE_NOTE"]), encryptedItemKey: cipher }).parse(input);
    const { user } = await requireFolderPermission(data.folderId, "MODIFY");
    await enforce("vaultWrite", user.id);
    const item = await prisma.vaultItem.create({
      data: { ...data, createdById: user.id, updatedById: user.id },
    });
    await logVaultEvent(user.id, "ITEM_CREATED", { itemId: item.id, folderId: item.folderId, targetName: item.name });
    revalidate();
    return { itemId: item.id };
  });
}

export async function updateItem(itemId: string, input: { name: string; url: string | null; tags: string[]; encryptedData: string; passwordChanged: boolean }) {
  return run(async () => {
    const data = itemFields.extend({ passwordChanged: z.boolean() }).parse(input);
    const { user, item } = await requireItemPermission(itemId, "MODIFY");
    await enforce("vaultWrite", user.id);
    const { passwordChanged, ...fields } = data;
    await prisma.vaultItem.update({
      where: { id: itemId },
      data: { ...fields, updatedById: user.id, ...(passwordChanged ? { passwordUpdatedAt: new Date() } : {}) },
    });
    await logVaultEvent(user.id, "ITEM_UPDATED", { itemId, folderId: item.folderId, targetName: fields.name, metadata: { passwordChanged } });
    revalidate();
    return {};
  });
}

export async function deleteItem(itemId: string) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultWrite", user.id);
    const access = await getItemPermission(itemId, user.id);
    // Deleting needs folder access; a direct share alone isn't enough.
    if (!access || !atLeast(access.viaFolder, "MODIFY")) throw new VaultAccessError("You don't have permission to delete this password.");
    await logVaultEvent(user.id, "ITEM_DELETED", { folderId: access.item.folderId, targetName: access.item.name });
    await prisma.vaultItem.delete({ where: { id: itemId } });
    revalidate();
    return {};
  });
}

/** The browser re-wraps the same item key with the target folder's key. */
export async function moveItem(itemId: string, targetFolderId: string, encryptedItemKey: string) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("vaultWrite", user.id);
    const access = await getItemPermission(itemId, user.id);
    if (!access || !atLeast(access.viaFolder, "MODIFY")) throw new VaultAccessError("You don't have permission to move this password.");
    const target = await requireFolderPermission(targetFolderId, "MODIFY");
    await prisma.vaultItem.update({
      where: { id: itemId },
      data: { folderId: targetFolderId, encryptedItemKey: cipher.parse(encryptedItemKey), updatedById: user.id },
    });
    await logVaultEvent(user.id, "ITEM_MOVED", {
      itemId,
      folderId: targetFolderId,
      targetName: access.item.name,
      metadata: { from: access.item.folder.name, to: target.folder.name },
    });
    revalidate();
    return {};
  });
}

export async function toggleFavorite(itemId: string) {
  return run(async () => {
    const { user } = await requireItemPermission(itemId, "VIEW");
    await enforce("vaultWrite", user.id);
    const key = { userId_itemId: { userId: user.id, itemId } };
    const existing = await prisma.vaultFavorite.findUnique({ where: key });
    if (existing) await prisma.vaultFavorite.delete({ where: key });
    else await prisma.vaultFavorite.create({ data: { userId: user.id, itemId } });
    revalidate();
    return { favorite: !existing };
  });
}

// ---------- sharing ----------

export type Recipient =
  | { status: "ready"; userId: string; name: string; publicKey: string }
  | { status: "no-vault"; userId: string; name: string }
  | { status: "not-registered" };

export async function findRecipient(rawEmail: string) {
  return run(async () => {
    const user = await requireVaultUser();
    await enforce("findRecipient", user.id);
    const address = email.parse(rawEmail);
    if (address === user.email.toLowerCase()) throw new VaultAccessError("You can't share with yourself.");
    const found = await prisma.user.findFirst({
      where: { email: { equals: address, mode: "insensitive" } },
      select: { id: true, name: true, vaultAccount: { select: { publicKey: true } } },
    });
    const recipient: Recipient = !found
      ? { status: "not-registered" }
      : found.vaultAccount
        ? { status: "ready", userId: found.id, name: found.name, publicKey: found.vaultAccount.publicKey }
        : { status: "no-vault", userId: found.id, name: found.name };
    return { recipient };
  });
}

type ShareInput = { email: string; permission: "MANAGE" | "MODIFY" | "VIEW"; sealedKey: string | null };

async function resolveShareTarget(input: ShareInput) {
  const data = z.object({ email, permission: shareable, sealedKey: sealed.nullable() }).parse(input);
  const recipient = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: "insensitive" } },
    select: { id: true, name: true, vaultAccount: { select: { userId: true } } },
  });
  // A key can only be sealed for someone who already has a vault (public key).
  const sealedKey = recipient?.vaultAccount ? data.sealedKey : null;
  if (recipient?.vaultAccount && !sealedKey) throw new VaultAccessError("Missing encrypted key for recipient.");
  return { data, recipient, sealedKey };
}

export async function shareFolder(folderId: string, input: ShareInput) {
  return run(async () => {
    const { user, folder } = await requireFolderPermission(folderId, "MANAGE");
    await enforce("share", user.id);
    if (folder.isPersonal) throw new VaultAccessError("Your personal vault can't be shared. Create a shared folder instead.");
    const { data, recipient, sealedKey } = await resolveShareTarget(input);

    if (recipient) {
      if (recipient.id === user.id) throw new VaultAccessError("You can't share with yourself.");
      const existing = await prisma.vaultFolderMember.findUnique({ where: { folderId_userId: { folderId, userId: recipient.id } } });
      if (existing) throw new VaultAccessError(`${recipient.name} already has access to this folder.`);
      await prisma.vaultFolderMember.create({
        data: { folderId, userId: recipient.id, permission: data.permission, encryptedFolderKey: sealedKey, addedById: user.id },
      });
    } else {
      await prisma.vaultInvite.create({ data: { folderId, email: data.email, permission: data.permission, invitedById: user.id } });
    }
    await logVaultEvent(user.id, "FOLDER_SHARED", { folderId, targetName: folder.name, metadata: { with: data.email, permission: data.permission } });
    revalidate();
    return { pending: !sealedKey };
  });
}

export async function shareItem(itemId: string, input: ShareInput) {
  return run(async () => {
    const { user, item } = await requireItemPermission(itemId, "MANAGE");
    await enforce("share", user.id);
    const { data, recipient, sealedKey } = await resolveShareTarget(input);

    if (recipient) {
      if (recipient.id === user.id) throw new VaultAccessError("You can't share with yourself.");
      const existing = await prisma.vaultItemShare.findUnique({ where: { itemId_userId: { itemId, userId: recipient.id } } });
      if (existing) throw new VaultAccessError(`${recipient.name} already has access to this password.`);
      await prisma.vaultItemShare.create({
        data: { itemId, userId: recipient.id, permission: data.permission, encryptedItemKey: sealedKey, sharedById: user.id },
      });
    } else {
      await prisma.vaultInvite.create({ data: { itemId, email: data.email, permission: data.permission, invitedById: user.id } });
    }
    await logVaultEvent(user.id, "ITEM_SHARED", { itemId, folderId: item.folderId, targetName: item.name, metadata: { with: data.email, permission: data.permission } });
    revalidate();
    return { pending: !sealedKey };
  });
}

export type AccessEntry = {
  kind: "folderMember" | "itemShare" | "invite";
  id: string;
  name: string;
  email: string;
  permission: VaultPermission;
  pending: boolean;
  isOwner: boolean;
  isYou: boolean;
};

export async function getAccessList(target: { folderId: string } | { itemId: string }) {
  return run(async () => {
    const entries: AccessEntry[] = [];
    let viewerId: string;
    if ("folderId" in target) {
      const { user } = await requireFolderPermission(target.folderId, "VIEW");
      viewerId = user.id;
      const [members, invites] = await Promise.all([
        prisma.vaultFolderMember.findMany({ where: { folderId: target.folderId }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
        prisma.vaultInvite.findMany({ where: { folderId: target.folderId } }),
      ]);
      for (const m of members)
        entries.push({ kind: "folderMember", id: m.id, name: m.user.name, email: m.user.email, permission: m.permission, pending: !m.encryptedFolderKey, isOwner: m.permission === "OWNER", isYou: m.userId === viewerId });
      for (const i of invites) entries.push({ kind: "invite", id: i.id, name: i.email, email: i.email, permission: i.permission, pending: true, isOwner: false, isYou: false });
    } else {
      const { user } = await requireItemPermission(target.itemId, "VIEW");
      viewerId = user.id;
      const [shares, invites] = await Promise.all([
        prisma.vaultItemShare.findMany({ where: { itemId: target.itemId }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
        prisma.vaultInvite.findMany({ where: { itemId: target.itemId } }),
      ]);
      for (const s of shares)
        entries.push({ kind: "itemShare", id: s.id, name: s.user.name, email: s.user.email, permission: s.permission, pending: !s.encryptedItemKey, isOwner: false, isYou: s.userId === viewerId });
      for (const i of invites) entries.push({ kind: "invite", id: i.id, name: i.email, email: i.email, permission: i.permission, pending: true, isOwner: false, isYou: false });
    }
    return { entries };
  });
}

/** Loads an access row and checks the caller may manage it. */
async function requireManageableEntry(kind: AccessEntry["kind"], id: string) {
  if (kind === "folderMember") {
    const row = await prisma.vaultFolderMember.findUnique({ where: { id }, include: { folder: true, user: { select: { email: true } } } });
    if (!row) throw new VaultAccessError("Access entry not found.");
    const { user } = await requireFolderPermission(row.folderId, "MANAGE");
    await enforce("share", user.id);
    if (row.permission === "OWNER") throw new VaultAccessError("The owner's access can't be changed.");
    return { user, folderId: row.folderId, itemId: null, label: row.folder.name, who: row.user.email };
  }
  if (kind === "itemShare") {
    const row = await prisma.vaultItemShare.findUnique({ where: { id }, include: { item: true, user: { select: { email: true } } } });
    if (!row) throw new VaultAccessError("Access entry not found.");
    const { user } = await requireItemPermission(row.itemId, "MANAGE");
    await enforce("share", user.id);
    return { user, folderId: row.item.folderId, itemId: row.itemId, label: row.item.name, who: row.user.email };
  }
  const row = await prisma.vaultInvite.findUnique({ where: { id }, include: { folder: true, item: true } });
  if (!row) throw new VaultAccessError("Invite not found.");
  const { user } = row.folderId ? await requireFolderPermission(row.folderId, "MANAGE") : await requireItemPermission(row.itemId!, "MANAGE");
  return { user, folderId: row.folderId ?? row.item?.folderId ?? null, itemId: row.itemId, label: row.folder?.name ?? row.item?.name ?? "", who: row.email };
}

export async function updateAccess(kind: AccessEntry["kind"], id: string, permission: "MANAGE" | "MODIFY" | "VIEW") {
  return run(async () => {
    const level = shareable.parse(permission);
    const entry = await requireManageableEntry(kind, id);
    if (kind === "folderMember") await prisma.vaultFolderMember.update({ where: { id }, data: { permission: level } });
    else if (kind === "itemShare") await prisma.vaultItemShare.update({ where: { id }, data: { permission: level } });
    else await prisma.vaultInvite.update({ where: { id }, data: { permission: level } });
    await logVaultEvent(entry.user.id, "ACCESS_CHANGED", { folderId: entry.folderId, itemId: entry.itemId, targetName: entry.label, metadata: { who: entry.who, permission: level } });
    revalidate();
    return {};
  });
}

export async function revokeAccess(kind: AccessEntry["kind"], id: string) {
  return run(async () => {
    const entry = await requireManageableEntry(kind, id);
    if (kind === "folderMember") await prisma.vaultFolderMember.delete({ where: { id } });
    else if (kind === "itemShare") await prisma.vaultItemShare.delete({ where: { id } });
    else await prisma.vaultInvite.delete({ where: { id } });
    await logVaultEvent(entry.user.id, "ACCESS_REVOKED", { folderId: entry.folderId, itemId: entry.itemId, targetName: entry.label, metadata: { who: entry.who } });
    revalidate();
    return {};
  });
}

/**
 * A recipient waiting for a key, plus the granter's own copy of that key so
 * the browser can decrypt it and re-seal it for the recipient.
 */
export type PendingGrant =
  | { kind: "folder"; id: string; publicKey: string; mySealedFolderKey: string }
  | { kind: "item"; id: string; publicKey: string; via: "folder"; wrappedItemKey: string; mySealedFolderKey: string }
  | { kind: "item"; id: string; publicKey: string; via: "share"; mySealedItemKey: string };

/** Members/shares waiting for a key that the current user is able to grant. */
export async function getPendingGrants() {
  return run(async () => {
    const user = await requireVaultUser();
    const managed = await prisma.vaultFolderMember.findMany({
      where: { userId: user.id, permission: { in: ["OWNER", "MANAGE"] }, encryptedFolderKey: { not: null } },
      select: { folderId: true, encryptedFolderKey: true },
    });
    const myFolderKey = new Map(managed.map((m) => [m.folderId, m.encryptedFolderKey!]));
    const folderIds = [...myFolderKey.keys()];
    const [members, shares] = await Promise.all([
      prisma.vaultFolderMember.findMany({
        where: { folderId: { in: folderIds }, encryptedFolderKey: null, user: { vaultAccount: { isNot: null } } },
        select: { id: true, folderId: true, user: { select: { vaultAccount: { select: { publicKey: true } } } } },
      }),
      prisma.vaultItemShare.findMany({
        where: {
          encryptedItemKey: null,
          user: { vaultAccount: { isNot: null } },
          OR: [
            { item: { folderId: { in: folderIds } } },
            { item: { shares: { some: { userId: user.id, permission: "MANAGE", encryptedItemKey: { not: null } } } } },
          ],
        },
        select: {
          id: true,
          user: { select: { vaultAccount: { select: { publicKey: true } } } },
          item: { select: { folderId: true, encryptedItemKey: true, shares: { where: { userId: user.id }, select: { encryptedItemKey: true } } } },
        },
      }),
    ]);

    const grants: PendingGrant[] = members.map((m) => ({
      kind: "folder",
      id: m.id,
      publicKey: m.user.vaultAccount!.publicKey,
      mySealedFolderKey: myFolderKey.get(m.folderId)!,
    }));
    for (const s of shares) {
      const publicKey = s.user.vaultAccount!.publicKey;
      const folderKey = myFolderKey.get(s.item.folderId);
      const myShareKey = s.item.shares[0]?.encryptedItemKey;
      if (folderKey) grants.push({ kind: "item", id: s.id, publicKey, via: "folder", wrappedItemKey: s.item.encryptedItemKey, mySealedFolderKey: folderKey });
      else if (myShareKey) grants.push({ kind: "item", id: s.id, publicKey, via: "share", mySealedItemKey: myShareKey });
    }
    return { grants };
  });
}

export async function grantAccess(kind: "folder" | "item", id: string, sealedKey: string) {
  return run(async () => {
    const key = sealed.parse(sealedKey);
    if (kind === "folder") {
      const row = await prisma.vaultFolderMember.findUnique({ where: { id }, include: { folder: true, user: { select: { email: true } } } });
      if (!row) throw new VaultAccessError("Access entry not found.");
      const { user } = await requireFolderPermission(row.folderId, "MANAGE");
      if (row.encryptedFolderKey) return {};
      await prisma.vaultFolderMember.update({ where: { id }, data: { encryptedFolderKey: key } });
      await logVaultEvent(user.id, "KEY_GRANTED", { folderId: row.folderId, targetName: row.folder.name, metadata: { who: row.user.email } });
    } else {
      const row = await prisma.vaultItemShare.findUnique({ where: { id }, include: { item: true, user: { select: { email: true } } } });
      if (!row) throw new VaultAccessError("Access entry not found.");
      const { user } = await requireItemPermission(row.itemId, "MANAGE");
      if (row.encryptedItemKey) return {};
      await prisma.vaultItemShare.update({ where: { id }, data: { encryptedItemKey: key } });
      await logVaultEvent(user.id, "KEY_GRANTED", { itemId: row.itemId, folderId: row.item.folderId, targetName: row.item.name, metadata: { who: row.user.email } });
    }
    return {};
  });
}

/** Data needed by the browser to re-encrypt a folder after someone loses access. */
export async function getRotationTargets(folderId: string) {
  return run(async () => {
    await requireFolderPermission(folderId, "MANAGE");
    const [members, items] = await Promise.all([
      prisma.vaultFolderMember.findMany({
        where: { folderId, encryptedFolderKey: { not: null } },
        select: { id: true, user: { select: { vaultAccount: { select: { publicKey: true } } } } },
      }),
      prisma.vaultItem.findMany({
        where: { folderId },
        select: {
          id: true,
          shares: { where: { encryptedItemKey: { not: null } }, select: { id: true, user: { select: { vaultAccount: { select: { publicKey: true } } } } } },
        },
      }),
    ]);
    return {
      members: members.map((m) => ({ memberId: m.id, publicKey: m.user.vaultAccount!.publicKey })),
      items: items.map((i) => ({ itemId: i.id, shares: i.shares.map((s) => ({ shareId: s.id, publicKey: s.user.vaultAccount!.publicKey })) })),
    };
  });
}

/** Replace the folder key and every item key in it (after revoking someone). */
export async function rotateFolderKey(
  folderId: string,
  input: {
    members: { memberId: string; sealedKey: string }[];
    items: { itemId: string; encryptedItemKey: string; encryptedData: string; shares: { shareId: string; sealedKey: string }[] }[];
  },
) {
  return run(async () => {
    const { user, folder } = await requireFolderPermission(folderId, "MANAGE");
    await enforce("vaultKeyChange", user.id);
    const data = z
      .object({
        members: z.array(z.object({ memberId: z.string(), sealedKey: sealed })),
        items: z.array(z.object({ itemId: z.string(), encryptedItemKey: cipher, encryptedData: cipher, shares: z.array(z.object({ shareId: z.string(), sealedKey: sealed })) })),
      })
      .parse(input);

    // The browser must cover exactly the current members and items, or someone would lose access.
    const [members, items] = await Promise.all([
      prisma.vaultFolderMember.findMany({ where: { folderId, encryptedFolderKey: { not: null } }, select: { id: true } }),
      prisma.vaultItem.findMany({ where: { folderId }, select: { id: true } }),
    ]);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    if (!same(members.map((m) => m.id), data.members.map((m) => m.memberId)) || !same(items.map((i) => i.id), data.items.map((i) => i.itemId))) {
      throw new VaultAccessError("The folder changed while rotating. Please try again.");
    }

    await prisma.$transaction([
      ...data.members.map((m) => prisma.vaultFolderMember.update({ where: { id: m.memberId }, data: { encryptedFolderKey: m.sealedKey } })),
      ...data.items.map((i) => prisma.vaultItem.update({ where: { id: i.itemId }, data: { encryptedItemKey: i.encryptedItemKey, encryptedData: i.encryptedData } })),
      ...data.items.flatMap((i) => i.shares.map((s) => prisma.vaultItemShare.update({ where: { id: s.shareId, itemId: i.itemId }, data: { encryptedItemKey: s.sealedKey } }))),
    ]);
    await logVaultEvent(user.id, "KEY_ROTATED", { folderId, targetName: folder.name, metadata: { items: data.items.length } });
    revalidate();
    return {};
  });
}

// ---------- audit ----------

export type AuditRow = {
  id: string;
  action: string;
  label: string;
  actorName: string;
  actorEmail: string;
  targetName: string | null;
  folderName: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export async function listAuditLogs(input: { action?: string; folderId?: string; actorId?: string; from?: string; to?: string; cursor?: string }) {
  return run(async () => {
    const user = await requireVaultUser();
    const filters = z
      .object({ action: z.string().optional(), folderId: z.string().optional(), actorId: z.string().optional(), from: z.string().optional(), to: z.string().optional(), cursor: z.string().optional() })
      .parse(input);

    // You see your own events plus everything in folders you manage.
    const managed = await prisma.vaultFolderMember.findMany({
      where: { userId: user.id, permission: { in: ["OWNER", "MANAGE"] } },
      select: { folderId: true },
    });
    const managedIds = managed.map((m) => m.folderId);

    const rows = await prisma.vaultAuditLog.findMany({
      where: {
        AND: [
          { OR: [{ actorId: user.id }, { folderId: { in: managedIds } }] },
          filters.action ? { action: filters.action } : {},
          filters.folderId ? { folderId: filters.folderId } : {},
          filters.actorId ? { actorId: filters.actorId } : {},
          filters.from ? { createdAt: { gte: new Date(filters.from) } } : {},
          filters.to ? { createdAt: { lte: new Date(`${filters.to}T23:59:59.999Z`) } } : {},
        ],
      },
      include: { actor: { select: { name: true, email: true } }, folder: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, 50);
    const logs: AuditRow[] = page.map((r) => ({
      id: r.id,
      action: r.action,
      label: VAULT_ACTIONS[r.action as keyof typeof VAULT_ACTIONS] ?? r.action,
      actorName: r.actor.name,
      actorEmail: r.actor.email,
      targetName: r.targetName,
      folderName: r.folder?.name ?? null,
      metadata: r.metadata,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    }));
    return { logs, nextCursor: rows.length > 50 ? page[page.length - 1]!.id : null };
  });
}

/** Who can access which folder/password, for folders you manage. */
export async function getAccessOverview() {
  return run(async () => {
    const user = await requireVaultUser();
    const folders = await prisma.vaultFolder.findMany({
      where: { members: { some: { userId: user.id, permission: { in: ["OWNER", "MANAGE"] } } }, isPersonal: false },
      include: {
        members: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
        invites: true,
      },
      orderBy: { name: "asc" },
    });
    const sharedItems = await prisma.vaultItem.findMany({
      where: { shares: { some: {} }, folder: { members: { some: { userId: user.id, permission: { in: ["OWNER", "MANAGE"] } } } } },
      include: { shares: { include: { user: { select: { name: true, email: true } } } }, folder: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        people: [
          ...f.members.map((m) => ({ name: m.user.name, email: m.user.email, permission: m.permission, pending: !m.encryptedFolderKey })),
          ...f.invites.map((i) => ({ name: i.email, email: i.email, permission: i.permission, pending: true })),
        ],
      })),
      items: sharedItems.map((i) => ({
        id: i.id,
        name: i.name,
        folderName: i.folder.name,
        people: i.shares.map((s) => ({ name: s.user.name, email: s.user.email, permission: s.permission, pending: !s.encryptedItemKey })),
      })),
    };
  });
}

export async function listAuditFilterOptions() {
  return run(async () => {
    const user = await requireVaultUser();
    const memberships = await prisma.vaultFolderMember.findMany({
      where: { userId: user.id },
      include: { folder: { select: { id: true, name: true, members: { include: { user: { select: { id: true, name: true } } } } } } },
    });
    const people = new Map<string, string>();
    for (const m of memberships) for (const fm of m.folder.members) people.set(fm.user.id, fm.user.name);
    return {
      folders: memberships.map((m) => ({ id: m.folder.id, name: m.folder.name })),
      people: [...people].map(([id, n]) => ({ id, name: n })),
      actions: Object.entries(VAULT_ACTIONS).map(([value, label]) => ({ value, label })),
    };
  });
}
