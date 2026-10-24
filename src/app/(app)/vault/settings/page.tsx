import { Suspense } from "react";
import { getVaultAccount } from "@/lib/vault-data";
import { PageHeader } from "@/components/page";
import { ProfileSkeleton } from "@/components/skeletons";
import { VaultSettings } from "@/components/vault/vault-settings";

export default function VaultSettingsPage() {
  return (
    <>
      <PageHeader title="Vault Settings" description="Security settings for your password vault." />
      <Suspense fallback={<ProfileSkeleton />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const account = await getVaultAccount();
  if (!account) return null;
  return <VaultSettings account={account} />;
}
