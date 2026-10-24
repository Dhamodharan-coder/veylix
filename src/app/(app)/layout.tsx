import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LogoMark } from "@/components/logo";
import { NavMain, NavUser } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { NavMainSkeleton, NavUserSkeleton } from "@/components/skeletons";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard">
                  <LogoMark />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">envman</span>
                    <span className="truncate text-xs text-muted-foreground">Secrets manager</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
          <span className="ml-1 text-sm text-muted-foreground">Workspace</span>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <div className="flex-1 px-4 pb-10 md:px-8">
          <div className="mx-auto w-full max-w-6xl pt-2">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function CurrentUser() {
  const user = await requireUser();
  return <NavUser name={user.name} email={user.email} />;
}
