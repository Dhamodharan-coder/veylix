"use client";

import { useState } from "react";
import { Check, Copy, Download, KeyRound, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { notify } from "@/components/toast";

function recoveryKitText(recoveryKey: string, email: string) {
  return [
    "VEYLIX VAULT RECOVERY KEY",
    "=========================",
    "",
    `Account:  ${email}`,
    `Created:  ${new Date().toLocaleString()}`,
    "",
    `Recovery key:  ${recoveryKey}`,
    "",
    "If you forget your master password, open the Veylix Vault, click",
    "\"Forgot master password?\" and enter this recovery key to set a new one.",
    "",
    "Keep this somewhere safe and offline (a password manager, a printed copy",
    "in a drawer). Anyone with this key AND access to your Veylix account can",
    "unlock your vault. Veylix cannot recover it for you.",
  ].join("\n");
}

/** Shows a freshly generated recovery key once, with copy/download/print. */
export function RecoveryKeyPanel({
  recoveryKey,
  email,
  onDone,
  doneLabel = "Continue to my vault",
}: {
  recoveryKey: string;
  email: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    notify.success("Recovery key copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([recoveryKitText(recoveryKey, email)], { type: "text/plain" }));
    Object.assign(document.createElement("a"), { href: url, download: "veylix-recovery-key.txt" }).click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const w = window.open("", "_blank", "width=640,height=520");
    if (!w) return;
    w.document.write(`<pre style="font:14px/1.6 ui-monospace,Menlo,monospace;padding:24px;white-space:pre-wrap">${recoveryKitText(recoveryKey, email).replace(/</g, "&lt;")}</pre>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-success/10 text-success">
          <KeyRound className="size-6" />
        </div>
        <h2 className="text-xl font-semibold">Save your recovery key</h2>
        <p className="text-sm text-muted-foreground">
          If you ever forget your master password, this key is the <b className="text-foreground">only way</b> to get back into your vault. It&apos;s shown only once.
        </p>
      </div>

      <div className="rounded-xl bg-muted/60 p-4 text-center ring-1 ring-foreground/10">
        <p className="font-mono text-lg font-semibold tracking-wider break-all select-all sm:text-xl">{recoveryKey}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="text-success" /> : <Copy />} Copy
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <Download /> Download
        </Button>
        <Button type="button" variant="outline" onClick={print}>
          <Printer /> Print
        </Button>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg bg-warning/10 p-3 text-sm">
        <Checkbox checked={saved} onCheckedChange={(c) => setSaved(c === true)} className="mt-0.5" />
        <span>I&apos;ve saved my recovery key somewhere safe. I understand Veylix can&apos;t show it again.</span>
      </label>

      <Button size="lg" className="h-10" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}
