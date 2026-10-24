import { Suspense } from "react";
import { loadVaultSnapshot } from "@/lib/vault-data";
import { PasswordsView } from "@/components/vault/passwords-view";
import { VaultListSkeleton } from "@/components/skeletons";

export default function AllPasswordsPage() {
  return (
    <Suspense fallback={<VaultListSkeleton />}>
      <AllPasswords />
    </Suspense>
  );
}

async function AllPasswords() {
  const snapshot = await loadVaultSnapshot();
  return (
    <PasswordsView
      snapshot={snapshot}
      filter={{ kind: "all" }}
      title="All Passwords"
      description="Every password you own or that's shared with you, encrypted end to end."
    />
  );
}
