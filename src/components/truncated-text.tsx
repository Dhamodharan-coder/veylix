"use client";

import { useRef, useState, type ElementType, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Single-line text that ends in "…" when it doesn't fit, with a tooltip showing
 * the full text. The tooltip only opens when the text is actually cut off.
 */
export function TruncatedText({
  as: Tag = "span",
  className,
  children,
  tooltip,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Tooltip content when it should differ from `children` (e.g. without badges). */
  tooltip?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const isTruncated = () => !!ref.current && ref.current.scrollWidth > ref.current.clientWidth;

  return (
    <Tooltip open={open} onOpenChange={(next) => setOpen(next && isTruncated())}>
      <TooltipTrigger asChild>
        <Tag ref={ref} className={cn("truncate", className)}>
          {children}
        </Tag>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all">{tooltip ?? children}</TooltipContent>
    </Tooltip>
  );
}
