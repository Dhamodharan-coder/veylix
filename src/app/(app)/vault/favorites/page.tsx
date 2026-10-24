import { Suspense } from "react";
import { loadVaultSnapshot } from "@/lib/vault-data";
import { PasswordsView } from "@/components/vault/passwords-view";
import { VaultListSkeleton } from "@/components/skeletons";

export default function FavoritesPage() {
  return (
    <Suspense fallback={<VaultListSkeleton />}>
      <Favorites />
    </Suspense>
  );
}

async function Favorites() {
  const snapshot = await loadVaultSnapshot();
  return <PasswordsView snapshot={snapshot} filter={{ kind: "favorites" }} title="Favorites" description="Passwords you've starred for quick access." />;
}
