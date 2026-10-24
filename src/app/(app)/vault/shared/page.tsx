import { Suspense } from "react";
import { loadVaultSnapshot } from "@/lib/vault-data";
import { PasswordsView } from "@/components/vault/passwords-view";
import { VaultListSkeleton } from "@/components/skeletons";

export default function SharedPage() {
  return (
    <Suspense fallback={<VaultListSkeleton />}>
      <Shared />
    </Suspense>
  );
}

async function Shared() {
  const snapshot = await loadVaultSnapshot();
  return (
    <PasswordsView
      snapshot={snapshot}
      filter={{ kind: "shared" }}
      title="Shared with me"
      description="Passwords and folders your teammates have shared with you."
    />
  );
}
