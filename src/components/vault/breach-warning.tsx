"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { formatBreachCount, pwnedCount } from "@/lib/breach-check";

/** Debounced "found in N breaches" hint under a password field. */
export function BreachWarning({ password }: { password: string }) {
  const [result, setResult] = useState<{ password: string; count: number | null } | null>(null);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      pwnedCount(password)
        .then((count) => !cancelled && setResult({ password, count }))
        .catch(() => !cancelled && setResult({ password, count: null }));
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [password]);

  // Only show a result for the password currently in the field.
  if (!password || !result || result.password !== password || result.count === null) return null;

  return result.count > 0 ? (
    <p className="flex items-start gap-1.5 text-xs text-destructive">
      <ShieldAlert className="mt-px size-3.5 shrink-0" />
      Found in {formatBreachCount(result.count)} data breaches. Choose a different password.
    </p>
  ) : (
    <p className="flex items-center gap-1.5 text-xs text-success">
      <ShieldCheck className="size-3.5" /> Not found in known data breaches
    </p>
  );
}
