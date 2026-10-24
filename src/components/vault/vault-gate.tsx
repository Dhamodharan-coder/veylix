"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StrengthMeter } from "@/components/vault/strength-meter";
import { useVault } from "@/components/vault/vault-provider";
import { RecoveryKeyPanel } from "@/components/vault/recovery-key-panel";
import { ForgotMasterPassword } from "@/components/vault/forgot-master-password";
import { passwordStrength } from "@/lib/password-strength";
import { generateRecoveryKey, sealPrivateKeyWithRecoveryKey, unlockPrivateKeyBytes } from "@/lib/vault-crypto";
import { setRecoveryKey } from "@/app/(app)/vault/actions";
import type { VaultAccountInfo } from "@/lib/vault-data";

type GateUser = { email: string; hasPassword: boolean };

const REMIND_LATER_KEY = "veylix-recovery-remind-later";

export function VaultGate({ account, user, children }: { account: VaultAccountInfo | null; user: GateUser; children: ReactNode }) {
  const router = useRouter();
  const { unlocked } = useVault();
  const [forgot, setForgot] = useState(false);
  // Vaults created before recovery keys existed: offer one right after unlock,
  // while the master password is still at hand (it's needed to create the key).
  const [upgradePassword, setUpgradePassword] = useState<string | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);

  if (account && newRecoveryKey) {
    return (
      <GateFrame>
        <Card className="shadow-sm">
          <CardContent>
            <RecoveryKeyPanel
              recoveryKey={newRecoveryKey}
              email={user.email}
              onDone={() => {
                setNewRecoveryKey(null);
                router.refresh();
              }}
            />
          </CardContent>
        </Card>
      </GateFrame>
    );
  }

  if (account && unlocked && upgradePassword) {
    return (
      <GateFrame>
        <RecoveryUpgradePrompt
          account={account}
          password={upgradePassword}
          onCreated={(key) => {
            setUpgradePassword(null);
            setNewRecoveryKey(key);
          }}
          onLater={() => {
            try {
              sessionStorage.setItem(REMIND_LATER_KEY, "1");
            } catch {}
            setUpgradePassword(null);
          }}
        />
      </GateFrame>
    );
  }

  if (unlocked && account) {
    return (
      <>
        {!account.recoveryWrappedPrivateKey && <MissingRecoveryKeyBanner />}
        {children}
      </>
    );
  }

  return (
    <GateFrame>
        {!account ? (
          <SetupForm email={user.email} />
        ) : forgot ? (
          <Card className="shadow-sm">
            <CardContent>
              <ForgotMasterPassword account={account} email={user.email} hasPassword={user.hasPassword} onBack={() => setForgot(false)} />
            </CardContent>
          </Card>
        ) : (
          <UnlockForm
            account={account}
            onForgot={() => setForgot(true)}
            onBeforeUnlock={(password) => {
              let remindLater = false;
              try {
                remindLater = sessionStorage.getItem(REMIND_LATER_KEY) === "1";
              } catch {}
              if (!account.recoveryWrappedPrivateKey && !remindLater) setUpgradePassword(password);
            }}
            onUnlockFailed={() => setUpgradePassword(null)}
          />
        )}
    </GateFrame>
  );
}

function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function RecoveryUpgradePrompt({
  account,
  password,
  onCreated,
  onLater,
}: {
  account: VaultAccountInfo;
  password: string;
  onCreated: (recoveryKey: string) => void;
  onLater: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setPending(true);
    setError(null);
    try {
      const pkcs8 = await unlockPrivateKeyBytes(password, account);
      const key = generateRecoveryKey();
      const res = await setRecoveryKey(await sealPrivateKeyWithRecoveryKey(pkcs8, key));
      if (!res.ok) throw new Error(res.error);
      onCreated(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a recovery key");
      setPending(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <GateHeader
        icon={<KeyRound />}
        title="Protect your vault with a recovery key"
        description="Veylix now supports recovery keys. If you ever forget your master password, a recovery key is the only way back into your vault without losing your passwords."
      />
      <CardContent className="grid gap-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ul className="grid gap-2 rounded-lg bg-muted/60 p-4 text-sm">
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> Generated on this device, never sent to Veylix</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> Takes a few seconds: save it, print it, or download it</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> Your passwords and shared folders stay exactly as they are</li>
        </ul>
        <Button size="lg" className="h-10" onClick={create} disabled={pending}>
          {pending ? <><LoaderCircle className="animate-spin" /> Creating…</> : <><KeyRound /> Create recovery key</>}
        </Button>
        <Button variant="ghost" onClick={onLater} disabled={pending}>
          Remind me later
        </Button>
      </CardContent>
    </Card>
  );
}

function MissingRecoveryKeyBanner() {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl bg-warning/10 p-4 ring-1 ring-warning/30 sm:flex-row sm:items-center">
      <TriangleAlert className="size-5 shrink-0 text-warning" />
      <p className="flex-1 text-sm">
        <span className="font-medium">Your vault has no recovery key.</span>{" "}
        <span className="text-muted-foreground">If you forget your master password, your passwords can&apos;t be recovered.</span>
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/vault/settings">
          <KeyRound /> Create recovery key
        </Link>
      </Button>
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

function UnlockForm({
  account,
  onForgot,
  onBeforeUnlock,
  onUnlockFailed,
}: {
  account: VaultAccountInfo;
  onForgot: () => void;
  onBeforeUnlock: (password: string) => void;
  onUnlockFailed: () => void;
}) {
  const { unlock } = useVault();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      // Set up the recovery-key prompt before unlocking so the vault doesn't flash first.
      onBeforeUnlock(password);
      await unlock(password, account);
    } catch {
      onUnlockFailed();
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
          <button type="button" onClick={onForgot} className="justify-self-center text-sm font-medium text-primary hover:underline">
            Forgot master password?
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Your master password never leaves this device. It locks again after {account.autoLockMinutes} minutes of inactivity.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function SetupForm({ email }: { email: string }) {
  const router = useRouter();
  const { setup } = useVault();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

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
      // Show the recovery key before entering the vault (refresh happens after).
      setRecoveryKey(await setup(password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set up your vault.");
    } finally {
      setPending(false);
    }
  };

  if (recoveryKey) {
    return (
      <Card className="shadow-sm">
        <CardContent>
          <RecoveryKeyPanel recoveryKey={recoveryKey} email={email} onDone={() => router.refresh()} />
        </CardContent>
      </Card>
    );
  }

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
