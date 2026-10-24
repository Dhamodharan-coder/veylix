"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, FolderKanban, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/page";
import { themeOptions, useThemeChoice } from "@/components/theme";
import { useConfirm } from "@/components/confirm-dialog";

const links = [
  { href: "/dashboard", label: "Projects", icon: FolderKanban, match: ["/dashboard", "/projects"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

export function NavMain() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:pt-3">
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:gap-2.5">
        {links.map(({ href, label, icon: Icon, match }) => (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton asChild isActive={match.some((m) => pathname.startsWith(m))} tooltip={label}>
              <Link href={href} onClick={() => setOpenMobile(false)}>
                <Icon />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function NavUser({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useThemeChoice();
  const confirm = useConfirm();

  const signOut = async () => {
    const ok = await confirm({
      title: "Sign out?",
      description: "You'll need to sign in again to access your projects.",
      confirmText: "Sign out",
      tone: "danger",
    });
    if (!ok) return;
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* Non-modal so the sign-out confirmation dialog can take focus cleanly. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <UserAvatar name={name} className="size-8" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar name={name} className="size-8" />
                <div className="grid flex-1 leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ThemeIcon /> Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                    {themeOptions.map(({ value, label, icon: Icon }) => (
                      <DropdownMenuRadioItem key={value} value={value}>
                        <Icon /> {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={signOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
