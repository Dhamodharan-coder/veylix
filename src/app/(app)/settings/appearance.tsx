"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { themeOptions, useThemeChoice } from "@/components/theme";
import { cn } from "@/lib/utils";

type Variant = (typeof themeOptions)[number]["value"];

/** Mini window mock-ups so each option previews its colors. */
function Preview({ variant }: { variant: Variant }) {
  const pane = (dark: boolean) => (
    <div className={cn("flex h-full gap-1.5 p-1.5", dark ? "bg-neutral-800" : "bg-neutral-100")}>
      <div className="flex w-1/4 flex-col gap-1 pt-1">
        <div className={cn("h-1.5 w-3/4 rounded-full", dark ? "bg-neutral-600" : "bg-neutral-300")} />
        <div className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-neutral-600" : "bg-neutral-300")} />
      </div>
      <div className={cn("flex flex-1 flex-col gap-1.5 rounded-md p-2 shadow-sm", dark ? "bg-neutral-950" : "bg-white")}>
        <div className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-200")} />
        <div className="h-1.5 w-1/3 rounded-full bg-blue-500" />
        <div className={cn("h-1.5 w-2/3 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-200")} />
      </div>
    </div>
  );
  if (variant === "system") {
    return (
      <div className="relative h-full">
        {pane(false)}
        <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">{pane(true)}</div>
      </div>
    );
  }
  return pane(variant === "dark");
}

export function AppearanceSettings() {
  const { theme, setTheme } = useThemeChoice();
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how envman looks to you. System follows your device setting.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid gap-4 sm:grid-cols-3">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "group overflow-hidden rounded-xl text-left ring-1 transition",
                  selected ? "ring-2 ring-primary" : "ring-foreground/10 hover:ring-foreground/25",
                )}
              >
                <div className="h-24">
                  <Preview variant={value} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-muted-foreground" /> {label}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full transition",
                      selected ? "bg-primary text-primary-foreground" : "ring-1 ring-foreground/15",
                    )}
                  >
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
