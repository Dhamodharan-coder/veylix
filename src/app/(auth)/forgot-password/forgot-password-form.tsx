"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/page";
import { AuthPanel, FormMessage, authLink } from "../auth-panel";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: String(new FormData(e.currentTarget).get("email")),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) return setError(error.message ?? "Something went wrong.");
    setSent(true);
  }

  return (
    <AuthPanel title="Forgot password?" subtitle="Enter your email and we'll send you a reset link.">
      {sent ? (
        <FormMessage tone="success">If an account exists for that email, a reset link is on its way. Check your inbox.</FormMessage>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4">
          {error && <FormMessage>{error}</FormMessage>}
          <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
          <Button size="lg" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <Link href="/sign-in" className={`inline-flex items-center justify-center gap-1.5 text-sm ${authLink}`}>
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthPanel>
  );
}
