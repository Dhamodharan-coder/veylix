import Link from "next/link";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex aspect-square size-8 items-center justify-center rounded-lg",
        inverted ? "bg-white/15 text-white" : "bg-primary text-primary-foreground",
        className,
      )}
    >
      <KeyRound className="size-4" strokeWidth={2.25} />
    </span>
  );
}

export function Logo({ href = "/dashboard", inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark inverted={inverted} />
      <span className={cn("font-semibold tracking-tight", inverted && "text-white")}>Veylix</span>
    </Link>
  );
}
