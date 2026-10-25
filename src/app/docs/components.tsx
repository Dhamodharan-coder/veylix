import type { ReactNode } from "react";
import { CircleAlert, Info, Lightbulb, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export { CodeBlock } from "./code-block";

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Page title + intro paragraph. */
export function DocHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <header className="mb-10">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{children}</p>
    </header>
  );
}

function Heading({ as: Tag, id, children, className }: { as: "h2" | "h3"; id?: string; children: string; className: string }) {
  const anchor = id ?? slug(children);
  return (
    <Tag id={anchor} className={cn("group scroll-mt-20", className)}>
      <a href={`#${anchor}`} className="inline-flex items-center gap-2">
        {children}
        <Link2 className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </a>
    </Tag>
  );
}

export const H2 = ({ id, children }: { id?: string; children: string }) => (
  <Heading as="h2" id={id} className="mt-12 mb-4 border-b pb-2 text-2xl font-semibold tracking-tight">
    {children}
  </Heading>
);

export const H3 = ({ id, children }: { id?: string; children: string }) => (
  <Heading as="h3" id={id} className="mt-8 mb-3 text-lg font-semibold">
    {children}
  </Heading>
);

const calloutStyles = {
  note: { icon: Info, className: "bg-primary/5 ring-primary/20", iconClass: "text-primary" },
  tip: { icon: Lightbulb, className: "bg-success/5 ring-success/25", iconClass: "text-success" },
  warning: { icon: CircleAlert, className: "bg-warning/5 ring-warning/30", iconClass: "text-warning" },
};

export function Callout({ type = "note", title, children }: { type?: keyof typeof calloutStyles; title?: string; children: ReactNode }) {
  const { icon: Icon, className, iconClass } = calloutStyles[type];
  return (
    <div className={cn("my-5 flex gap-3 rounded-xl p-4 text-sm ring-1", className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
      <div className="grid gap-1 [&_p]:m-0">
        {title && <p className="font-medium">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Simple bordered table for options, parameters and status codes. */
export function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t align-top">
              {row.map((cell, j) => (
                <td key={j} className={cn("px-4 py-2.5", j === 0 ? "whitespace-nowrap" : "text-muted-foreground")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const methodColors: Record<string, string> = {
  GET: "bg-success/10 text-success",
  PUT: "bg-warning/10 text-warning",
  DELETE: "bg-destructive/10 text-destructive",
};

/** HTTP method badge + path, used as an endpoint heading. */
export function Endpoint({ method, path }: { method: "GET" | "PUT" | "DELETE"; path: string }) {
  return (
    <div className="my-4 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 font-mono text-sm ring-1 ring-foreground/10">
      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", methodColors[method])}>{method}</span>
      <span className="break-all">{path}</span>
    </div>
  );
}

/** Inline code. */
export const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
);

/** Grid of linked cards (used on overview pages). */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="my-6 grid gap-4 sm:grid-cols-2">{children}</div>;
}
