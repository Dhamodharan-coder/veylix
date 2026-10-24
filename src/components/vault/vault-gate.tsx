"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StrengthMeter } from "@/components/vault/strength-meter";
import { useVault } from "@/components/vault/vault-provider";
import { passwordStrength } from "@/lib/password-strength";
import type { VaultAccountInfo } from "@/lib/vault-data";

export function VaultGate({ account, children }: { account: VaultAccountInfo | null; children: ReactNode }) {
  const { unlocked } = useVault();
  if (unlocked && account) return <>{children}</>;
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-8">
      <div className="w-full max-w-md">{account ? <UnlockForm account={account} /> : <SetupForm />}</div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoFocus, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className="h-10 pr-10"
        required
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

function GateHeader({ icon, title, description }: { icon: ReactNode; title: string; description: ReactNode }) {
  return (
    <CardHeader className="items-center text-center">
      <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-6">{icon}</div>
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );
}

function UnlockForm({ account }: { account: VaultAccountInfo }) {
  const { unlock } = useVault();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await unlock(password, account);
    } catch {
      setError("Incorrect master password. Please try again.");
      setPassword("");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <GateHeader icon={<LockKeyhole />} title="Unlock your vault" description="Enter your master password to decrypt your passwords." />
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="master-password">Master password</Label>
            <PasswordInput id="master-password" value={password} onChange={setPassword} autoFocus autoComplete="current-password" />
          </div>
          <Button size="lg" className="h-10" disabled={pending || !password}>
            {pending ? <><LoaderCircle className="animate-spin" /> Unlocking…</> : "Unlock"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Your master password never leaves this device. It locks again after {account.autoLockMinutes} minutes of inactivity.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function SetupForm() {
  const router = useRouter();
  const { setup } = useVault();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const strength = passwordStrength(password);
  const tooWeak = password.length < 10 || strength.score < 2;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tooWeak) return setError("Choose a stronger master password: at least 10 characters and rated Fair or better.");
    if (password !== confirm) return setError("Master passwords don't match.");
    setPending(true);
    setError(null);
    try {
      await setup(password);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set up your vault.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <GateHeader
        icon={<ShieldCheck />}
        title="Set up your vault"
        description="Create a master password. It's separate from your login password and encrypts everything in your vault."
      />
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="new-master">Master password</Label>
            <PasswordInput id="new-master" value={password} onChange={setPassword} autoFocus autoComplete="new-password" />
            <StrengthMeter password={password} showHints />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-master">Confirm master password</Label>
            <PasswordInput id="confirm-master" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
          </div>

          <div className="flex gap-3 rounded-lg bg-warning/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="grid gap-2">
              <p>
                <span className="font-medium">We can&apos;t recover your master password.</span>{" "}
                <span className="text-muted-foreground">If you forget it, everything in your vault is permanently lost.</span>
              </p>
              <label className="flex items-center gap-2 font-medium">
                <Checkbox checked={understood} onCheckedChange={(c) => setUnderstood(c === true)} />
                I understand and have saved it somewhere safe
              </label>
            </div>
          </div>

          <Button size="lg" className="h-10" disabled={pending || !understood || !password || !confirm}>
            {pending ? <><LoaderCircle className="animate-spin" /> Creating your vault…</> : "Create vault"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
