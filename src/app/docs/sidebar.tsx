"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DOCS_NAV, DOCS_PAGES } from "./nav";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const sections = q
    ? DOCS_NAV.map((s) => ({ ...s, pages: s.pages.filter((p) => `${s.title} ${p.title} ${p.keywords ?? ""}`.toLowerCase().includes(q)) })).filter((s) => s.pages.length)
    : DOCS_NAV;

  return (
    <nav aria-label="Documentation" className="grid gap-6">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search docs…" aria-label="Search docs" className="pl-8" />
      </div>
      {sections.length === 0 && <p className="px-2 text-sm text-muted-foreground">No pages match “{query}”.</p>}
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section.title}</p>
          <ul className="grid gap-0.5">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition",
                      active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto py-8 pr-4 lg:block">
      <NavLinks />
    </aside>
  );
}

export function MobileDocsNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = DOCS_PAGES.find((p) => p.href === pathname);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="lg:hidden">
          <Menu /> {current?.title ?? "Menu"}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Documentation</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Previous / next page links at the bottom of each page. */
export function DocsPager() {
  const pathname = usePathname();
  const i = DOCS_PAGES.findIndex((p) => p.href === pathname);
  if (i === -1) return null;
  const prev = DOCS_PAGES[i - 1];
  const next = DOCS_PAGES[i + 1];
  return (
    <div className="mt-16 grid gap-3 border-t pt-6 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="rounded-xl p-4 ring-1 ring-foreground/10 transition hover:bg-muted">
          <span className="block text-xs text-muted-foreground">Previous</span>
          <span className="font-medium">← {prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="rounded-xl p-4 text-right ring-1 ring-foreground/10 transition hover:bg-muted">
          <span className="block text-xs text-muted-foreground">Next</span>
          <span className="font-medium">{next.title} →</span>
        </Link>
      )}
    </div>
  );
}
