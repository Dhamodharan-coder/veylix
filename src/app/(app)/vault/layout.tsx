import { Suspense } from "react";
import { getVaultAccount } from "@/lib/vault-data";
import { VaultGate } from "@/components/vault/vault-gate";
import { AuthCardSkeleton } from "@/components/skeletons";

export default function VaultLayout({ children }: LayoutProps<"/vault">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-16">
          <AuthCardSkeleton fields={1} />
        </div>
      }
    >
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const account = await getVaultAccount();
  return <VaultGate account={account}>{children}</VaultGate>;
}
