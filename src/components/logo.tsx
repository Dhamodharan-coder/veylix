import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Veylix logo image. Generated from brand/logo.png by `npm run brand`;
 * replace that one file to rebrand everywhere.
 */
export function LogoMark({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={64}
      height={64}
      priority
      className={cn("size-8 shrink-0 object-contain", inverted && "drop-shadow-sm", className)}
    />
  );
}

export function Logo({ href = "/dashboard", inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark inverted={inverted} />
      <span className={cn("text-[15px] font-semibold tracking-tight", inverted && "text-white")}>Veylix</span>
    </Link>
  );
}
