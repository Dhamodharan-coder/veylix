"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { CircleHelp, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
 * Promise-based confirmation dialog (shadcn AlertDialog):
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete?", tone: "danger" })) { ... }
 */
export function useConfirm(): ConfirmFn {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const resolveRef = useRef<((result: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false); // a newer request cancels any open one
        resolveRef.current = resolve;
        setTyped("");
        setOptions(opts);
        setOpen(true);
      }),
    [],
  );

  const settle = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOpen(false); // options stay set so the closing animation keeps its content
  };

  const danger = options?.tone === "danger";
  const canConfirm = !options?.requireText || typed === options.requireText;

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={cn(danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
              {danger ? <TriangleAlert /> : <CircleHelp />}
            </AlertDialogMedia>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
          </AlertDialogHeader>

          {options?.requireText && (
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (canConfirm) settle(true);
              }}
            >
              <Label htmlFor="confirm-text" className="font-normal text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{options.requireText}</span> to confirm
              </Label>
              <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" className="font-mono" />
            </form>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{options?.cancelText ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              variant={danger ? "danger" : "default"}
              disabled={!canConfirm}
              onClick={(e) => {
                e.preventDefault();
                settle(true);
              }}
            >
              {options?.confirmText ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext>
  );
}
