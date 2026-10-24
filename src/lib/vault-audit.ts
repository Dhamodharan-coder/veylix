import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const VAULT_ACTIONS = {
  VAULT_CREATED: "Vault created",
  VAULT_UNLOCKED: "Vault unlocked",
  MASTER_PASSWORD_CHANGED: "Master password changed",
  FOLDER_CREATED: "Folder created",
  FOLDER_RENAMED: "Folder renamed",
  FOLDER_DELETED: "Folder deleted",
  ITEM_CREATED: "Password added",
  ITEM_UPDATED: "Password edited",
  ITEM_DELETED: "Password deleted",
  ITEM_MOVED: "Password moved",
  PASSWORD_REVEALED: "Password viewed",
  PASSWORD_COPIED: "Password copied",
  USERNAME_COPIED: "Username copied",
  URL_OPENED: "Website opened",
  AUTOFILLED: "Autofilled by extension",
  EXTENSION_UNLOCKED: "Unlocked in extension",
  FOLDER_SHARED: "Folder shared",
  ITEM_SHARED: "Password shared",
  ACCESS_CHANGED: "Access changed",
  ACCESS_REVOKED: "Access revoked",
  KEY_GRANTED: "Access granted",
  KEY_ROTATED: "Encryption key rotated",
} as const;

export type VaultAction = keyof typeof VAULT_ACTIONS;

/** Client-reported access events (decryption happens in the browser). */
export const CLIENT_ACCESS_ACTIONS = [
  "VAULT_UNLOCKED",
  "PASSWORD_REVEALED",
  "PASSWORD_COPIED",
  "USERNAME_COPIED",
  "URL_OPENED",
  "AUTOFILLED",
  "EXTENSION_UNLOCKED",
] as const;

export async function logVaultEvent(
  actorId: string,
  action: VaultAction,
  target: { folderId?: string | null; itemId?: string | null; targetName?: string | null; metadata?: Prisma.InputJsonValue } = {},
) {
  const h = await headers();
  await prisma.vaultAuditLog.create({
    data: {
      actorId,
      action,
      folderId: target.folderId ?? null,
      itemId: target.itemId ?? null,
      targetName: target.targetName ?? null,
      metadata: target.metadata,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    },
  });
}
