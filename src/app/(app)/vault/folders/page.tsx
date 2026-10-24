import { Suspense } from "react";
import { loadVaultSnapshot } from "@/lib/vault-data";
import { FoldersView } from "@/components/vault/folders-view";
import { DashboardSkeleton } from "@/components/skeletons";

export default function FoldersPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Folders />
    </Suspense>
  );
}

async function Folders() {
  return <FoldersView snapshot={await loadVaultSnapshot()} />;
}
