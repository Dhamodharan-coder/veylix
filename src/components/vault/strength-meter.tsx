import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];
const TEXT = ["text-destructive", "text-destructive", "text-warning", "text-success", "text-success"];

export function StrengthMeter({ password, showHints = false, className }: { password: string; showHints?: boolean; className?: string }) {
  const s = passwordStrength(password);
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", password && i < Math.max(1, s.score) && COLORS[s.score])} />
        ))}
      </div>
      {password && (
        <p className="text-xs text-muted-foreground">
          Strength: <span className={cn("font-medium", TEXT[s.score])}>{s.label}</span>
          {showHints && s.hints[0] && s.score < 3 && <> · {s.hints[0]}</>}
        </p>
      )}
    </div>
  );
}
