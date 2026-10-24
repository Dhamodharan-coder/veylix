"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/** Mounted once in the root layout. */
export function Toaster() {
  return <SonnerToaster position="bottom-right" theme="system" richColors closeButton duration={2500} />;
}

type NotifyOptions = { description?: string; duration?: number };

/** App-wide alerts. Use these instead of calling sonner directly. */
export const notify = {
  success: (message: string, opts?: NotifyOptions) => toast.success(message, opts),
  error: (message: string, opts?: NotifyOptions) => toast.error(message, opts),
  info: (message: string, opts?: NotifyOptions) => toast.info(message, opts),
  warning: (message: string, opts?: NotifyOptions) => toast.warning(message, opts),
};
