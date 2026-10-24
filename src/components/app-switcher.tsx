"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, KeyRound, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export const MODULES = [
  { id: "env", name: "Env Manager", description: "Environment variables", href: "/dashboard", icon: KeyRound, color: "bg-primary" },
  { id: "vault", name: "Vault", description: "Password manager", href: "/vault", icon: ShieldCheck, color: "bg-emerald-600" },
] as const;

export const currentModule = (pathname: string) => (pathname.startsWith("/vault") ? MODULES[1] : MODULES[0]);

/** Zoho-style switcher between Veylix modules (shadcn TeamSwitcher pattern). */
export function AppSwitcher() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const active = currentModule(pathname);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <span className={cn("flex aspect-square size-8 items-center justify-center rounded-lg text-white", active.color)}>
                <active.icon className="size-4" />
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Veylix</span>
                <span className="truncate text-xs text-muted-foreground">{active.name}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-60 rounded-lg" align="start" side={isMobile ? "bottom" : "right"} sideOffset={4}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Veylix apps</DropdownMenuLabel>
            {MODULES.map((m) => (
              <DropdownMenuItem key={m.id} asChild className="gap-3 p-2">
                <Link href={m.href} onClick={() => setOpenMobile(false)}>
                  <span className={cn("flex size-8 items-center justify-center rounded-md text-white", m.color)}>
                    <m.icon className="size-4" />
                  </span>
                  <span className="grid flex-1 leading-tight">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.description}</span>
                  </span>
                  {m.id === active.id && <Check className="text-primary" />}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
