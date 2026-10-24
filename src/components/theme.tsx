"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props} />;
}

export const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** The stored theme isn't known during SSR; only trust it after hydration. */
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function useThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return { theme: mounted ? theme : undefined, setTheme };
}

/** Compact three-way switch: Light / Dark / System. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeChoice();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex rounded-lg bg-muted p-0.5", className)}>
      {themeOptions.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md py-1.5 text-muted-foreground transition",
            theme === value ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
