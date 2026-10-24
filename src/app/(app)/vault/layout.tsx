import { Suspense } from "react";
import { getVaultAccount } from "@/lib/vault-data";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
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
  const user = await requireUser();
  const [account, credential] = await Promise.all([
    getVaultAccount(),
    // OAuth-only users have no password; vault reset then asks for their email instead.
    prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } }),
  ]);
  return (
    <VaultGate account={account} user={{ email: user.email, hasPassword: !!credential }}>
      {children}
    </VaultGate>
  );
}
