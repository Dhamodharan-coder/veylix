import { toast } from "sonner";

type NotifyOptions = { description?: string; duration?: number };

/** App-wide alerts (rendered by the shadcn <Toaster /> in the root layout). */
export const notify = {
  success: (message: string, opts?: NotifyOptions) => toast.success(message, opts),
  error: (message: string, opts?: NotifyOptions) => toast.error(message, opts),
  info: (message: string, opts?: NotifyOptions) => toast.info(message, opts),
  warning: (message: string, opts?: NotifyOptions) => toast.warning(message, opts),
};
