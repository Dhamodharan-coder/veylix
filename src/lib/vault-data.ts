import "server-only";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PERMISSION_RANK } from "@/lib/vault-access";
import type { VaultItemType, VaultPermission } from "@/generated/prisma/client";

// Shapes sent to the browser. Everything secret is ciphertext; the browser
// decrypts with keys it derives from the master password.

export type VaultAccountInfo = {
  kdfSalt: string;
  kdfIterations: number;
  publicKey: string;
  encryptedPrivateKey: string;
  autoLockMinutes: number;
  /** Private key sealed with the recovery key; null if none was created. */
  recoveryWrappedPrivateKey: string | null;
  recoveryCreatedAt: Date | null;
};

export type VaultFolderRecord = {
  id: string;
  name: string;
  isPersonal: boolean;
  permission: VaultPermission;
  /** null = shared with you but an owner hasn't granted the key yet */
  encryptedFolderKey: string | null;
  ownerName: string;
  isOwner: boolean;
  memberCount: number;
  itemCount: number;
};

export type VaultItemRecord = {
  id: string;
  folderId: string;
  folderName: string;
  type: VaultItemType;
  name: string;
  url: string | null;
  tags: string[];
  encryptedData: string;
  /** item key wrapped with the folder key (used when `via` is "folder") */
  encryptedItemKey: string;
  /** item key sealed to you (used when `via` is "share") */
  shareKey: string | null;
  via: "folder" | "share";
  permission: VaultPermission;
  canDelete: boolean;
  favorite: boolean;
  shared: boolean;
  sharedByName: string | null;
  passwordUpdatedAt: string;
  updatedAt: string;
  updatedByName: string;
};

export type VaultSnapshot = {
  folders: VaultFolderRecord[];
  items: VaultItemRecord[];
  /** Shared items you can't open yet (awaiting key) */
  awaiting: { id: string; name: string; sharedByName: string | null }[];
};

export async function getVaultAccount(): Promise<VaultAccountInfo | null> {
  const user = await requireUser();
  return prisma.vaultAccount.findUnique({
    where: { userId: user.id },
    select: {
      kdfSalt: true,
      kdfIterations: true,
      publicKey: true,
      encryptedPrivateKey: true,
      autoLockMinutes: true,
      recoveryWrappedPrivateKey: true,
      recoveryCreatedAt: true,
    },
  });
}

export async function loadVaultSnapshot(): Promise<VaultSnapshot> {
  const user = await requireUser();

  const memberships = await prisma.vaultFolderMember.findMany({
    where: { userId: user.id },
    include: {
      folder: {
        include: {
          owner: { select: { name: true } },
          _count: { select: { members: true, items: true } },
        },
      },
    },
    orderBy: { folder: { name: "asc" } },
  });

  const folders: VaultFolderRecord[] = memberships
    .map((m) => ({
      id: m.folderId,
      name: m.folder.name,
      isPersonal: m.folder.isPersonal,
      permission: m.permission,
      encryptedFolderKey: m.encryptedFolderKey,
      ownerName: m.folder.owner.name,
      isOwner: m.folder.ownerId === user.id,
      memberCount: m.folder._count.members,
      itemCount: m.folder._count.items,
    }))
    // Personal folder first, then alphabetical.
    .sort((a, b) => Number(b.isPersonal && b.isOwner) - Number(a.isPersonal && a.isOwner) || a.name.localeCompare(b.name));

  const readableFolderIds = folders.filter((f) => f.encryptedFolderKey).map((f) => f.id);
  const folderById = new Map(folders.map((f) => [f.id, f]));

  const userNames = (ids: string[]) =>
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).then((rows) => new Map(rows.map((r) => [r.id, r.name])));

  const [folderItems, shares, favorites] = await Promise.all([
    prisma.vaultItem.findMany({
      where: { folderId: { in: readableFolderIds } },
      include: { _count: { select: { shares: true } }, folder: { select: { _count: { select: { members: true } } } } },
    }),
    prisma.vaultItemShare.findMany({
      where: { userId: user.id },
      include: { item: { include: { folder: { select: { name: true } } } } },
    }),
    prisma.vaultFavorite.findMany({ where: { userId: user.id }, select: { itemId: true } }),
  ]);

  const favoriteIds = new Set(favorites.map((f) => f.itemId));
  const names = await userNames([
    ...new Set([...folderItems.map((i) => i.updatedById), ...shares.flatMap((s) => [s.sharedById, s.item.updatedById])]),
  ]);

  const items: VaultItemRecord[] = folderItems.map((i) => {
    const folder = folderById.get(i.folderId)!;
    const direct = shares.find((s) => s.itemId === i.id);
    const permission = direct && PERMISSION_RANK[direct.permission] > PERMISSION_RANK[folder.permission] ? direct.permission : folder.permission;
    return {
      id: i.id,
      folderId: i.folderId,
      folderName: folder.name,
      type: i.type,
      name: i.name,
      url: i.url,
      tags: i.tags,
      encryptedData: i.encryptedData,
      encryptedItemKey: i.encryptedItemKey,
      shareKey: null,
      via: "folder",
      permission,
      canDelete: PERMISSION_RANK[folder.permission] >= PERMISSION_RANK.MODIFY,
      favorite: favoriteIds.has(i.id),
      shared: i._count.shares > 0 || i.folder._count.members > 1,
      sharedByName: null,
      passwordUpdatedAt: i.passwordUpdatedAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      updatedByName: names.get(i.updatedById) ?? "Unknown",
    };
  });

  // Items shared directly with you that you can't already read through a folder.
  const awaiting: VaultSnapshot["awaiting"] = [];
  for (const s of shares) {
    if (readableFolderIds.includes(s.item.folderId)) continue;
    if (!s.encryptedItemKey) {
      awaiting.push({ id: s.itemId, name: s.item.name, sharedByName: names.get(s.sharedById) ?? null });
      continue;
    }
    items.push({
      id: s.item.id,
      folderId: s.item.folderId,
      folderName: s.item.folder.name,
      type: s.item.type,
      name: s.item.name,
      url: s.item.url,
      tags: s.item.tags,
      encryptedData: s.item.encryptedData,
      encryptedItemKey: s.item.encryptedItemKey,
      shareKey: s.encryptedItemKey,
      via: "share",
      permission: s.permission,
      canDelete: false,
      favorite: favoriteIds.has(s.itemId),
      shared: true,
      sharedByName: names.get(s.sharedById) ?? null,
      passwordUpdatedAt: s.item.passwordUpdatedAt.toISOString(),
      updatedAt: s.item.updatedAt.toISOString(),
      updatedByName: names.get(s.item.updatedById) ?? "Unknown",
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, items, awaiting };
}
