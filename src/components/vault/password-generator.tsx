"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StrengthMeter } from "@/components/vault/strength-meter";
import { notify } from "@/components/toast";

const SETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnopqrstuvwxyz",
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};

const WORDS =
  "able acid aged also area army away baby back ball band bank base bath bear beat bell belt best bird blue boat body bold bone book boss bowl brave bread brick brief bring broad brown build burn busy cable calm camp card care cargo cash cast cave chair chalk charm chef chess chief city clay clean clear cliff clock cloud coach coast coin cold coral corn crane crisp crown cube curve daily dance dawn deep delta desk dial diet dish dove draft dream drift drum dune eagle early earth echo edge elbow ember empty epic equal event exact fable faith fancy farm fern field film final flame flash fleet float flute focus forest frame fresh frost fruit gamma giant glass globe glow gold grace grain grape green grid group guide habit happy harbor heart honey horse hotel house humor icon ideal index iron ivory jacket jazz jelly jewel joke judge juice jungle karma kayak kettle kind kite knife koala label lake lamp laser lemon level light lime linen lion logic lotus lucky lunar magic maple marble meadow medal melon metal mint model moon motor mount music noble north novel oasis ocean olive omega opera orbit otter owner paddle panda paper peach pearl pepper piano pilot pixel plain planet plaza plum polar pond prism pulse quartz quest quiet radar rain raven ready relay ridge river robot rocket royal ruby saddle salad sand scout shadow shell shore silver sky slate smile solar sonic spark spice spoon spring stone storm sugar summit sunny swift table tango tiger timber toast topaz tower trail tulip ultra umbra unity urban valley vapor velvet violet vivid voice wagon water wave wheat whale willow window winter wolf yacht yellow yoga zebra zenith zone".split(
    " ",
  );

/** Unbiased random index in [0, max) using crypto.getRandomValues. */
function randomIndex(max: number) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % max;
}

type Options = { mode: "password" | "passphrase"; length: number; words: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean };

export function generatePassword(o: Options): string {
  if (o.mode === "passphrase") {
    const words = Array.from({ length: o.words }, () => WORDS[randomIndex(WORDS.length)]!);
    return `${words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join("-")}-${randomIndex(90) + 10}`;
  }
  const sets = (["upper", "lower", "digits", "symbols"] as const).filter((k) => o[k]).map((k) => SETS[k]);
  if (sets.length === 0) sets.push(SETS.lower);
  const all = sets.join("");
  // Guarantee one character from each chosen set, then shuffle.
  const chars = sets.map((s) => s[randomIndex(s.length)]!);
  while (chars.length < o.length) chars.push(all[randomIndex(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

const DEFAULTS: Options = { mode: "password", length: 20, words: 4, upper: true, lower: true, digits: true, symbols: true };

/** Generator panel. `onUse` receives the generated value (e.g. to fill a form). */
export function PasswordGenerator({ onUse }: { onUse?: (value: string) => void }) {
  const [options, setOptions] = useState<Options>(DEFAULTS);
  const [value, setValue] = useState(() => generatePassword(DEFAULTS));
  const [copied, setCopied] = useState(false);

  const update = (patch: Partial<Options>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setValue(generatePassword(next));
  };

  return (
    <div className="grid gap-4">
      <Tabs value={options.mode} onValueChange={(m) => update({ mode: m as Options["mode"] })}>
        <TabsList className="w-full">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="passphrase">Passphrase</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
        <code className="min-w-0 flex-1 font-mono text-sm break-all">{value}</code>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Regenerate" onClick={() => setValue(generatePassword(options))}>
          <RefreshCw />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copy"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            notify.success("Generated password copied");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </div>
      <StrengthMeter password={value} />

      {options.mode === "password" ? (
        <>
          <div className="grid gap-2">
            <div className="flex justify-between text-sm">
              <Label>Length</Label>
              <span className="tabular-nums text-muted-foreground">{options.length}</span>
            </div>
            <Slider min={8} max={64} step={1} value={[options.length]} onValueChange={([v]) => update({ length: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["upper", "Uppercase (A-Z)"],
                ["lower", "Lowercase (a-z)"],
                ["digits", "Numbers (0-9)"],
                ["symbols", "Symbols (!@#)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-foreground/10">
                {label}
                <Switch checked={options[key]} onCheckedChange={(c) => update({ [key]: c })} />
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <div className="flex justify-between text-sm">
            <Label>Words</Label>
            <span className="tabular-nums text-muted-foreground">{options.words}</span>
          </div>
          <Slider min={3} max={10} step={1} value={[options.words]} onValueChange={([v]) => update({ words: v })} />
        </div>
      )}

      {onUse && (
        <Button type="button" onClick={() => onUse(value)}>
          Use this password
        </Button>
      )}
    </div>
  );
}
