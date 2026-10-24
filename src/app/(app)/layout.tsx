import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { NavMain, NavUser } from "@/components/app-sidebar";
import { AppSwitcher } from "@/components/app-switcher";
import { ModuleLabel, VaultLockButton } from "@/components/header-context";
import { ModeToggle } from "@/components/mode-toggle";
import { VaultProvider } from "@/components/vault/vault-provider";
import { NavMainSkeleton, NavUserSkeleton } from "@/components/skeletons";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    // VaultProvider sits above both modules so switching apps doesn't lock the vault.
    <VaultProvider>
      <SidebarProvider>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader>
            <Suspense fallback={<Skeleton className="m-2 h-10" />}>
              <AppSwitcher />
            </Suspense>
          </SidebarHeader>
          <SidebarContent>
            <Suspense fallback={<NavMainSkeleton />}>
              <NavMain />
            </Suspense>
          </SidebarContent>
          <SidebarFooter>
            <Suspense fallback={<NavUserSkeleton />}>
              <CurrentUser />
            </Suspense>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Suspense>
              <ModuleLabel />
            </Suspense>
            <div className="ml-auto flex items-center gap-2">
              <Suspense>
                <VaultLockButton />
              </Suspense>
              <ModeToggle />
            </div>
          </header>
          <div className="flex-1 px-4 pb-10 md:px-8">
            <div className="mx-auto w-full max-w-6xl pt-2">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </VaultProvider>
  );
}

async function CurrentUser() {
  const user = await requireUser();
  return <NavUser name={user.name} email={user.email} />;
}
