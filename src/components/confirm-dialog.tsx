"use client";

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** "danger" = red confirm button and warning icon, for destructive actions. */
  tone?: "default" | "danger";
  /** User must type this exact text before the confirm button enables. */
  requireText?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based confirmation modal:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete?", tone: "danger" })) { ... }
 */
export function useConfirm(): ConfirmFn {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((result: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState("");

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false); // a newer request cancels any open one
        resolveRef.current = resolve;
        setTyped("");
        setOptions(opts);
      }),
    [],
  );

  const settle = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    setOptions(null);
  }, []);

  useEffect(() => {
    if (options && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [options]);

  const danger = options?.tone === "danger";
  const canConfirm = !options?.requireText || typed === options.requireText;

  return (
    <ConfirmContext value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={() => settle(false)} // Esc key
        onClick={(e) => e.target === dialogRef.current && settle(false)} // backdrop click
        aria-labelledby="confirm-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-black/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-white/15"
      >
        {options && (
          <form
            method="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              if (canConfirm) settle(true);
            }}
            className="flex flex-col gap-4 p-6"
          >
            <div className="flex gap-3">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  danger ? "bg-red-600/10 text-red-600" : "bg-black/5 dark:bg-white/10"
                }`}
              >
                {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
              </div>
              <div className="flex flex-col gap-1">
                <h2 id="confirm-title" className="text-base font-semibold">{options.title}</h2>
                {options.description && <div className="text-sm opacity-70">{options.description}</div>}
              </div>
            </div>

            {options.requireText && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="opacity-70">
                  Type <b className="font-mono opacity-100">{options.requireText}</b> to confirm
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/60"
                />
              </label>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => settle(false)} autoFocus={!options.requireText}>
                {options.cancelText ?? "Cancel"}
              </Button>
              <Button type="submit" variant={danger ? "destructive" : "primary"} disabled={!canConfirm}>
                {options.confirmText ?? "Confirm"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </ConfirmContext>
  );
}
