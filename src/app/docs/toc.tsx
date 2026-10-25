"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Heading = { id: string; text: string; level: number };

/** "On this page": built from the h2/h3 headings of the current article, highlighting the one in view. */
export function TableOfContents() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("#docs-content h2[id], #docs-content h3[id]")];
    // Read the headings after the new page has painted.
    const frame = requestAnimationFrame(() => {
      setHeadings(els.map((el) => ({ id: el.id, text: el.textContent ?? "", level: el.tagName === "H3" ? 3 : 2 })));
      setActive(els[0]?.id ?? null);
    });
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  if (headings.length < 2) return null;
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-52 shrink-0 overflow-y-auto py-8 xl:block">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">On this page</p>
      <ul className="grid gap-1 text-sm">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={cn("block py-0.5 transition hover:text-foreground", h.level === 3 && "pl-3", active === h.id ? "font-medium text-primary" : "text-muted-foreground")}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
