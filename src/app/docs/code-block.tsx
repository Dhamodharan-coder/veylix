"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "@/components/icon-button";
import { cn } from "@/lib/utils";

/** Dark code panel with an optional title and a copy button. */
export function CodeBlock({ code, title, className }: { code: string; title?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("group relative my-5 overflow-hidden rounded-xl bg-zinc-950 text-zinc-100 ring-1 ring-foreground/10 dark:bg-zinc-900", className)}>
      {title && <div className="border-b border-white/10 px-4 py-2 font-mono text-xs text-zinc-400">{title}</div>}
      <IconButton
        label={copied ? "Copied" : "Copy"}
        size="icon-sm"
        onClick={copy}
        className="absolute right-2 bottom-2 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100"
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </IconButton>
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-[13px] leading-6">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}
