"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Card, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
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
    <Card title="Forgot password" subtitle="We'll email you a link to reset it.">
      {sent ? (
        <Alert tone="success">If an account exists for that email, a reset link is on its way. Check your inbox.</Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Input label="Email" name="email" type="email" required autoComplete="email" />
          <Button disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <Link href="/sign-in" className="text-center text-sm underline">Back to sign in</Link>
    </Card>
  );
}
