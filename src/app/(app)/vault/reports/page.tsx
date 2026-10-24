import { Suspense } from "react";
import { loadVaultSnapshot } from "@/lib/vault-data";
import { getAccessOverview } from "@/app/(app)/vault/actions";
import { ReportsView } from "@/components/vault/reports-view";
import { DashboardSkeleton } from "@/components/skeletons";

export default function ReportsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  const [snapshot, overview] = await Promise.all([loadVaultSnapshot(), getAccessOverview().catch(() => null)]);
  return <ReportsView snapshot={snapshot} overview={overview?.ok ? overview : null} />;
}
