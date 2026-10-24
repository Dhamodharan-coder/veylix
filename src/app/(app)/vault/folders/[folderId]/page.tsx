import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadVaultSnapshot } from "@/lib/vault-data";
import { PasswordsView } from "@/components/vault/passwords-view";
import { FolderHeaderActions } from "@/components/vault/folder-header-actions";
import { VaultListSkeleton } from "@/components/skeletons";

export default function FolderPage(props: PageProps<"/vault/folders/[folderId]">) {
  return (
    <Suspense fallback={<VaultListSkeleton />}>
      <FolderPasswords {...props} />
    </Suspense>
  );
}

async function FolderPasswords({ params }: PageProps<"/vault/folders/[folderId]">) {
  const { folderId } = await params;
  const snapshot = await loadVaultSnapshot();
  const folder = snapshot.folders.find((f) => f.id === folderId && f.encryptedFolderKey);
  if (!folder) notFound();

  return (
    <PasswordsView
      snapshot={snapshot}
      filter={{ kind: "folder", folderId }}
      title={folder.name}
      description={
        folder.isPersonal
          ? "Your private folder. Items here are only visible to you unless you share them individually."
          : folder.isOwner
            ? `Shared folder · ${folder.memberCount} member${folder.memberCount === 1 ? "" : "s"}`
            : `Shared with you by ${folder.ownerName}`
      }
      breadcrumbs={[{ label: "Folders", href: "/vault/folders" }, { label: folder.name }]}
      headerActions={<FolderHeaderActions folderId={folderId} snapshot={snapshot} />}
    />
  );
}
