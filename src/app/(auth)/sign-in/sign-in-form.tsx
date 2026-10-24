"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Card, Input } from "@/components/ui";
import { SocialButtons } from "@/components/social-buttons";

export function SignInForm({ providers }: { providers: { github: boolean; google: boolean } }) {
  const router = useRouter();
  const justReset = useSearchParams().get("reset") === "1";
  const [error, setError] = useState<React.ReactNode>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));

    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email,
      password: String(form.get("password")),
      callbackURL: "/verify-email?verified=1",
    });
    setPending(false);

    if (error?.code === "EMAIL_NOT_VERIFIED") {
      // sendOnSignIn is enabled, so a fresh verification email was just sent.
      return setError(
        <>
          Your email isn&apos;t verified yet. We sent you a new link.{" "}
          <Link className="underline" href={`/verify-email?email=${encodeURIComponent(email)}`}>Didn&apos;t get it?</Link>
        </>,
      );
    }
    if (error) return setError(error.message ?? "Sign in failed.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card title="Sign in" subtitle="Welcome back to envman.">
      {justReset && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Input label="Email" name="email" type="email" required autoComplete="email" />
        <Input label="Password" name="password" type="password" required autoComplete="current-password" />
        <Link href="/forgot-password" className="-mt-2 self-end text-sm underline">Forgot password?</Link>
        <Button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="text-center text-sm">
        No account? <Link href="/sign-up" className="underline">Sign up</Link>
      </p>
    </Card>
  );
}
