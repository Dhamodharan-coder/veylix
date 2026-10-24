import type { ComponentProps, ReactNode } from "react";

export function Input({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/60"
        {...props}
      />
    </label>
  );
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "outline" | "danger" | "destructive" }) {
  const styles = {
    primary: "bg-foreground text-background hover:opacity-90",
    outline: "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
    danger: "text-red-600 hover:bg-red-600/10",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

/** Square icon-only button; `label` is the tooltip and the accessible name. */
export function IconButton({ label, variant = "default", className = "", ...props }: ComponentProps<"button"> & { label: string; variant?: "default" | "danger" }) {
  const styles = variant === "danger"
    ? "text-red-600 hover:bg-red-600/10"
    : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex size-9 items-center justify-center rounded-md transition disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  const styles = tone === "error"
    ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
    : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300";
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-black/10 p-6 shadow-sm dark:border-white/15">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-black/60 dark:text-white/60">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}
