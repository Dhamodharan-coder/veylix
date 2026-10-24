"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, Lock, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StrengthMeter } from "@/components/vault/strength-meter";
import { useVault } from "@/components/vault/vault-provider";
import { notify } from "@/components/toast";
import { passwordStrength } from "@/lib/password-strength";
import { rewrapPrivateKey } from "@/lib/vault-crypto";
import { changeMasterPassword, updateAutoLock } from "@/app/(app)/vault/actions";
import type { VaultAccountInfo } from "@/lib/vault-data";

const LOCK_OPTIONS = [5, 15, 30, 60, 240] as const;

export function VaultSettings({ account }: { account: VaultAccountInfo }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AutoLockCard account={account} />
      <ChangeMasterPasswordCard account={account} />
    </div>
  );
}

function AutoLockCard({ account }: { account: VaultAccountInfo }) {
  const router = useRouter();
  const { lock } = useVault();
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Auto-lock</CardTitle>
        <CardDescription>Lock the vault automatically after a period of inactivity. Reloading the page always locks it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Select
          defaultValue={String(account.autoLockMinutes)}
          onValueChange={async (v) => {
            const res = await updateAutoLock(Number(v));
            if (!res.ok) return notify.error(res.error);
            notify.success("Auto-lock updated", { description: "Takes effect the next time you unlock." });
            router.refresh();
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCK_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                After {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={lock}>
          <Lock /> Lock now
        </Button>
      </CardContent>
    </Card>
  );
}

function ChangeMasterPasswordCard({ account }: { account: VaultAccountInfo }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (next.length < 10 || passwordStrength(next).score < 2) return setError("Choose a stronger master password: at least 10 characters and rated Fair or better.");
    if (next !== confirm) return setError("New master passwords don't match.");
    if (next === current) return setError("The new master password must be different.");
    setPending(true);
    try {
      // Only the private key is re-encrypted; passwords and folder keys don't change.
      const rewrapped = await rewrapPrivateKey(current, next, account);
      const res = await changeMasterPassword(rewrapped);
      if (!res.ok) throw new Error(res.error);
      notify.success("Master password changed", { description: "Use your new master password next time you unlock." });
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the master password");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="shadow-xs">
      <form onSubmit={submit} className="contents">
        <CardHeader>
          <CardTitle>Change master password</CardTitle>
          <CardDescription>Your passwords stay encrypted; only the key protecting them is re-sealed with the new master password.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="current-master">Current master password</Label>
            <Input id="current-master" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="next-master">New master password</Label>
              <Input id="next-master" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
              <StrengthMeter password={next} showHints />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-next-master">Confirm new master password</Label>
              <Input id="confirm-next-master" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t bg-muted/40 py-3">
          <Button disabled={pending || !current || !next || !confirm}>
            {pending ? <><LoaderCircle className="animate-spin" /> Updating…</> : "Change master password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
