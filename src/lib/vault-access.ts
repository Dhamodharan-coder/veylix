import "server-only";
import { prisma } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/session";
import type { VaultPermission } from "@/generated/prisma/client";

// Every Vault server action must go through these checks; the server never
// trusts the client about who may read or change what.

export const PERMISSION_RANK: Record<VaultPermission, number> = { OWNER: 4, MANAGE: 3, MODIFY: 2, VIEW: 1 };

export const atLeast = (have: VaultPermission | null | undefined, need: VaultPermission) =>
  !!have && PERMISSION_RANK[have] >= PERMISSION_RANK[need];

export class VaultAccessError extends Error {}

/** The signed-in user, who must have set up a vault. */
export async function requireVaultUser(): Promise<CurrentUser> {
  const user = await requireUser();
  const account = await prisma.vaultAccount.findUnique({ where: { userId: user.id }, select: { userId: true } });
  if (!account) throw new VaultAccessError("Set up your vault first.");
  return user;
}

export async function requireFolderPermission(folderId: string, need: VaultPermission) {
  const user = await requireVaultUser();
  const member = await prisma.vaultFolderMember.findUnique({
    where: { folderId_userId: { folderId, userId: user.id } },
    include: { folder: true },
  });
  if (!member || !atLeast(member.permission, need)) throw new VaultAccessError("You don't have permission for this folder.");
  return { user, member, folder: member.folder };
}

/** Effective permission on an item: the higher of folder membership and direct share. */
export async function getItemPermission(itemId: string, userId: string) {
  const item = await prisma.vaultItem.findUnique({
    where: { id: itemId },
    include: {
      folder: { include: { members: { where: { userId } } } },
      shares: { where: { userId } },
    },
  });
  if (!item) return null;
  const viaFolder = item.folder.members[0]?.permission ?? null;
  const viaShare = item.shares[0]?.permission ?? null;
  const permission =
    viaFolder && viaShare ? (PERMISSION_RANK[viaFolder] >= PERMISSION_RANK[viaShare] ? viaFolder : viaShare) : (viaFolder ?? viaShare);
  return { item, permission, viaFolder, viaShare };
}

export async function requireItemPermission(itemId: string, need: VaultPermission) {
  const user = await requireVaultUser();
  const access = await getItemPermission(itemId, user.id);
  if (!access || !atLeast(access.permission, need)) throw new VaultAccessError("You don't have permission for this password.");
  return { user, ...access };
}
