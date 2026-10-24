"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/page";
import { AuthPanel, FormMessage, authLink } from "../auth-panel";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || params.get("error")) {
    return (
      <AuthPanel title="Link expired" subtitle="This reset link is invalid or has expired.">
        <FormMessage>Password reset links are valid for 1 hour and can only be used once.</FormMessage>
        <Link href="/forgot-password" className={`text-center text-sm ${authLink}`}>Request a new link</Link>
      </AuthPanel>
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
    <AuthPanel title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={onSubmit} className="grid gap-4">
        {error && <FormMessage>{error}</FormMessage>}
        <Field label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <Field label="Confirm new password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        <Button size="lg" disabled={pending}>{pending ? "Saving…" : "Reset password"}</Button>
      </form>
    </AuthPanel>
  );
}
