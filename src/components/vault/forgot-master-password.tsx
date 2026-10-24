"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CircleAlert, KeyRound, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StrengthMeter } from "@/components/vault/strength-meter";
import { RecoveryKeyPanel } from "@/components/vault/recovery-key-panel";
import { useVault } from "@/components/vault/vault-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { notify } from "@/components/toast";
import { passwordStrength } from "@/lib/password-strength";
import {
  generateRecoveryKey,
  openPrivateKeyWithRecoveryKey,
  sealPrivateKeyWithPassword,
  sealPrivateKeyWithRecoveryKey,
} from "@/lib/vault-crypto";
import { recoverVault, resetVault } from "@/app/(app)/vault/actions";
import type { VaultAccountInfo } from "@/lib/vault-data";

type Props = { account: VaultAccountInfo; email: string; hasPassword: boolean; onBack: () => void };

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function ForgotMasterPassword(props: Props) {
  const hasRecoveryKey = !!props.account.recoveryWrappedPrivateKey;
  return (
    <div className="grid gap-5">
      <button type="button" onClick={props.onBack} className="flex items-center gap-1.5 justify-self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to unlock
      </button>
      <div className="text-center">
        <h2 className="text-xl font-semibold">Forgot master password?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your vault is end-to-end encrypted, so it can only be opened with your recovery key.</p>
      </div>
      <Tabs defaultValue={hasRecoveryKey ? "recover" : "reset"}>
        <TabsList className="w-full">
          <TabsTrigger value="recover">
            <KeyRound /> Recovery key
          </TabsTrigger>
          <TabsTrigger value="reset">
            <RotateCcw /> Reset vault
          </TabsTrigger>
        </TabsList>
        <TabsContent value="recover" className="mt-4">
          {hasRecoveryKey ? (
            <RecoverWithKey {...props} />
          ) : (
            <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
              No recovery key was created for this vault, so it can&apos;t be recovered. You can reset the vault and start fresh instead.
            </p>
          )}
        </TabsContent>
        <TabsContent value="reset" className="mt-4">
          <ResetVault {...props} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecoverWithKey({ account, email }: Props) {
  const router = useRouter();
  const { unlockWithKey } = useVault();
  const [step, setStep] = useState<"key" | "password" | "saved">("key");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [pkcs8, setPkcs8] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newRecoveryKey, setNewRecoveryKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const checkKey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      setPkcs8(await openPrivateKeyWithRecoveryKey(recoveryKey, account.recoveryWrappedPrivateKey!));
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recovery key isn't correct");
    } finally {
      setPending(false);
    }
  };

  const setNewPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 10 || passwordStrength(password).score < 2) return setError("Choose a stronger master password: at least 10 characters and rated Fair or better.");
    if (password !== confirm) return setError("Master passwords don't match.");
    setPending(true);
    setError(null);
    try {
      // The used recovery key is replaced with a new one.
      const next = generateRecoveryKey();
      const res = await recoverVault({
        ...(await sealPrivateKeyWithPassword(pkcs8!, password)),
        recoveryWrappedPrivateKey: await sealPrivateKeyWithRecoveryKey(pkcs8!, next),
      });
      if (!res.ok) throw new Error(res.error);
      setNewRecoveryKey(next);
      setStep("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't recover your vault");
    } finally {
      setPending(false);
    }
  };

  if (step === "saved") {
    return (
      <RecoveryKeyPanel
        recoveryKey={newRecoveryKey}
        email={email}
        onDone={async () => {
          await unlockWithKey(pkcs8!, account);
          notify.success("Vault recovered", { description: "Use your new master password from now on." });
          router.refresh();
        }}
      />
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={setNewPassword} className="grid gap-4">
        <Alert>
          <KeyRound />
          <AlertDescription>Recovery key accepted. Choose a new master password.</AlertDescription>
        </Alert>
        <ErrorBox message={error} />
        <div className="grid gap-2">
          <Label htmlFor="recover-new">New master password</Label>
          <Input id="recover-new" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" className="h-10" />
          <StrengthMeter password={password} showHints />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recover-confirm">Confirm new master password</Label>
          <Input id="recover-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="h-10" />
        </div>
        <Button size="lg" className="h-10" disabled={pending || !password || !confirm}>
          {pending ? <><LoaderCircle className="animate-spin" /> Saving…</> : "Set new master password"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={checkKey} className="grid gap-4">
      <ErrorBox message={error} />
      <div className="grid gap-2">
        <Label htmlFor="recovery-key">Recovery key</Label>
        <Input
          id="recovery-key"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="h-10 font-mono uppercase placeholder:normal-case"
        />
        <p className="text-xs text-muted-foreground">From the recovery kit you saved when you created your vault (veylix-recovery-key.txt).</p>
      </div>
      <Button size="lg" className="h-10" disabled={pending || recoveryKey.replace(/[^0-9a-z]/gi, "").length < 32}>
        {pending ? <><LoaderCircle className="animate-spin" /> Checking…</> : "Continue"}
      </Button>
    </form>
  );
}

function ResetVault({ email, hasPassword }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = await confirm({
      title: "Reset your vault?",
      description: "Every password and folder you own will be permanently deleted. Items others shared with you will come back once they open their vault.",
      confirmText: "Reset vault",
      tone: "danger",
      requireText: "RESET",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const res = await resetVault(hasPassword ? { password: value } : { email: value });
    setPending(false);
    if (!res.ok) return setError(res.error);
    notify.success("Vault reset", { description: "Create a new master password to start again." });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="grid gap-1">
          <p className="font-medium text-destructive">This permanently deletes your vault data</p>
          <ul className="list-disc pl-4 text-muted-foreground">
            <li>Passwords and folders you own are deleted for everyone.</li>
            <li>Items shared <i>with</i> you are kept and re-shared automatically.</li>
            <li>You&apos;ll set a new master password afterwards.</li>
          </ul>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="grid gap-2">
        <Label htmlFor="reset-confirm">{hasPassword ? "Your Veylix login password" : `Type your account email (${email})`}</Label>
        <Input
          id="reset-confirm"
          type={hasPassword ? "password" : "email"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={hasPassword ? "current-password" : "off"}
          className="h-10"
          required
        />
        <p className="text-xs text-muted-foreground">This is your sign-in password, not the master password.</p>
      </div>
      <Button size="lg" variant="danger" className="h-10" disabled={pending || !value}>
        {pending ? <><LoaderCircle className="animate-spin" /> Resetting…</> : "Reset vault"}
      </Button>
    </form>
  );
}
