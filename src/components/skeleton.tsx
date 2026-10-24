/** Pulsing placeholder block. Size it with Tailwind classes, e.g. "h-4 w-32". */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} />;
}

/** Wraps a skeleton so screen readers announce loading once. */
function Loading({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
}

const rowBorder = "divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15";

export function UserMenuSkeleton() {
  return (
    <Loading label="Loading account" className="flex items-center gap-3">
      <Skeleton className="hidden h-4 w-44 sm:block" />
      <Skeleton className="h-9 w-20" />
    </Loading>
  );
}

export function SidebarNavSkeleton() {
  return (
    <Loading label="Loading navigation" className="flex gap-1 md:flex-col">
      <Skeleton className="h-9 w-28 md:w-full" />
      <Skeleton className="h-9 w-28 md:w-full" />
    </Loading>
  );
}

export function ProjectListSkeleton() {
  return (
    <Loading label="Loading projects" className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <Skeleton className="h-5 w-40" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ))}
    </Loading>
  );
}

export function SecretRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className={rowBorder}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 flex-1" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, j) => <Skeleton key={j} className="size-9" />)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectPageSkeleton() {
  return (
    <Loading label="Loading project">
      <Skeleton className="h-4 w-20" />
      <div className="mt-3 mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mb-4 flex gap-4 border-b border-black/10 pb-3 dark:border-white/15">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-28" />
      </div>
      <SecretRowsSkeleton />
    </Loading>
  );
}

export function ProfileSkeleton() {
  return (
    <Loading label="Loading profile" className="flex flex-col gap-4 sm:max-w-sm">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-16" />
    </Loading>
  );
}

export function AuthCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <Loading label="Loading" className="w-full max-w-sm rounded-xl border border-black/10 p-6 dark:border-white/15">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-6 flex flex-col gap-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-full" />
      </div>
    </Loading>
  );
}
