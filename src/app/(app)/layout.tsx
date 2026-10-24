import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { SidebarNav } from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarNavSkeleton, UserMenuSkeleton } from "@/components/skeleton";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-3 border-b border-black/10 p-3 dark:border-white/15 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:gap-6 md:border-r md:border-b-0 md:p-4">
        <Link href="/dashboard" className="px-3 font-mono text-lg font-bold">envman</Link>
        <Suspense fallback={<SidebarNavSkeleton />}>
          <SidebarNav />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-black/10 px-4 py-3 dark:border-white/15 sm:px-8">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden opacity-70 sm:inline">{user.email}</span>
      <SignOutButton />
    </div>
  );
}
