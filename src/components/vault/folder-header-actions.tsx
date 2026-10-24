"use client";

import { useRouter } from "next/navigation";
import { FolderMenu } from "@/components/vault/folder-actions";
import type { VaultSnapshot } from "@/lib/vault-data";

export function FolderHeaderActions({ folderId, snapshot }: { folderId: string; snapshot: VaultSnapshot }) {
  const router = useRouter();
  const folder = snapshot.folders.find((f) => f.id === folderId);
  if (!folder) return null;
  return (
    <FolderMenu
      folder={folder}
      folders={snapshot.folders}
      items={snapshot.items}
      trigger="buttons"
      afterDelete={() => router.push("/vault/folders")}
    />
  );
}
