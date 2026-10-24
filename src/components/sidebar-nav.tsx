"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Settings } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Projects", icon: FolderKanban, match: ["/dashboard", "/projects"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = match.some((m) => pathname.startsWith(m));
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-black/5 font-medium dark:bg-white/10"
                : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            }`}
          >
            <Icon size={16} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
