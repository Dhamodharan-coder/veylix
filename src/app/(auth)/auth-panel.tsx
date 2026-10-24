import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Heading + body for every auth screen. */
export function AuthPanel({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"} className={tone === "success" ? "text-success *:data-[slot=alert-description]:text-success/90" : undefined}>
      {tone === "error" ? <CircleAlert /> : <CircleCheck />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export const authLink = "font-medium text-primary underline-offset-4 hover:underline";
