"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Card, Input } from "@/components/ui";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || params.get("error")) {
    return (
      <Card title="Link expired">
        <Alert>This reset link is invalid or has expired.</Alert>
        <Link href="/forgot-password" className="text-center text-sm underline">Request a new link</Link>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== form.get("confirm")) return setError("Passwords do not match.");

    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    setPending(false);
    if (error) return setError(error.message ?? "Could not reset password.");
    router.push("/sign-in?reset=1");
  }

  return (
    <Card title="Choose a new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Input label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <Input label="Confirm new password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        <Button disabled={pending}>{pending ? "Saving…" : "Reset password"}</Button>
      </form>
    </Card>
  );
}
