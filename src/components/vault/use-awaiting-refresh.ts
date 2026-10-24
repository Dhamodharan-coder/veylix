"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While something shared with us is still awaiting its key, re-fetch the page
 * periodically (and on focus) so it appears as soon as the sharer grants it.
 */
export function useAwaitingRefresh(waiting: boolean, intervalMs = 20_000) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [waiting, intervalMs, router]);
}
