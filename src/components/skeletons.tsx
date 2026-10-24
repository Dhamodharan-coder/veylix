import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Wraps a skeleton so screen readers announce loading once. */
function Loading({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function NavMainSkeleton() {
  return (
    <Loading label="Loading navigation" className="flex flex-col gap-2 p-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </Loading>
  );
}

export function NavUserSkeleton() {
  return (
    <Loading label="Loading account" className="flex items-center gap-2 p-2">
      <Skeleton className="size-8 rounded-lg" />
      <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </Loading>
  );
}

/** Rows shaped like the data tables (`cols` = cell widths). */
export function TableRowsSkeleton({ rows = 5, cols }: { rows?: number; cols: string[] }) {
  return (
    <div>
      <div className="flex h-10 items-center gap-6 px-4">
        {cols.map((w, i) => <Skeleton key={i} className={`h-3 ${w}`} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-14 items-center gap-6 border-t px-4">
          {cols.map((w, i) => <Skeleton key={i} className={`h-4 ${w}`} />)}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading label="Loading projects" className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-14" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="h-8 w-64 max-sm:hidden" />
        </div>
        <TableRowsSkeleton rows={4} cols={["w-1/4", "w-1/3", "w-12 ml-auto", "w-20"]} />
      </Card>
    </Loading>
  );
}

export function ProjectPageSkeleton() {
  return (
    <Loading label="Loading project">
      <Skeleton className="h-4 w-44" />
      <div className="mt-4 mb-8 flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-4 w-80 max-sm:w-48" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="mb-6 h-9 w-96 max-w-full rounded-lg" />
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-44" />
            </div>
          </div>
          <div className="flex gap-2 max-lg:hidden">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <TableRowsSkeleton cols={["w-1/4", "w-1/3", "w-20", "w-32 ml-auto"]} />
      </Card>
    </Loading>
  );
}

export function ProfileSkeleton() {
  return (
    <Loading label="Loading profile">
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-xl" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-44" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Loading>
  );
}

export function AuthCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <Loading label="Loading" className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <Skeleton className="mt-2 h-8 w-full" />
      </div>
    </Loading>
  );
}
