"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/page";
import { SocialButtons } from "@/components/social-buttons";
import { AuthPanel, FormMessage, authLink } from "../auth-panel";

export function SignInForm({
  providers,
  emailEnabled,
}: {
  providers: { github: boolean; google: boolean };
  emailEnabled: boolean;
}) {
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
      callbackURL: "/dashboard",
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
    <AuthPanel title="Welcome back" subtitle="Sign in to your Veylix account.">
      {justReset && <FormMessage tone="success">Password updated. Sign in with your new password.</FormMessage>}
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="grid gap-4">
        {error && <FormMessage>{error}</FormMessage>}
        <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
        <div className="grid gap-2">
          <Field label="Password" name="password" type="password" required autoComplete="current-password" />
          {/* Password reset needs email delivery. */}
          {emailEnabled && (
            <Link href="/forgot-password" className={`justify-self-end text-sm ${authLink}`}>Forgot password?</Link>
          )}
        </div>
        <Button size="lg" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account? <Link href="/sign-up" className={authLink}>Sign up</Link>
      </p>
    </AuthPanel>
  );
}
