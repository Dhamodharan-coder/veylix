"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/page";
import { SocialButtons } from "@/components/social-buttons";
import { AuthPanel, FormMessage, authLink } from "../auth-panel";

export function SignUpForm({ providers }: { providers: { github: boolean; google: boolean } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name"));
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (password !== form.get("confirm")) return setError("Passwords do not match.");

    setPending(true);
    setError(null);
    const { data, error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/dashboard",
    });
    setPending(false);

    if (error) return setError(error.message ?? "Sign up failed.");
    // A session token means verification isn't required (EMAIL_ENABLED off).
    if (data?.token) {
      router.push("/dashboard");
      router.refresh();
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <AuthPanel title="Create your account" subtitle="Start managing your environment variables securely.">
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="grid gap-4">
        {error && <FormMessage>{error}</FormMessage>}
        <Field label="Full name" name="name" required autoComplete="name" placeholder="Jane Cooper" />
        <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          <Field label="Confirm password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">At least 8 characters.</p>
        <Button size="lg" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/sign-in" className={authLink}>Sign in</Link>
      </p>
    </AuthPanel>
  );
}
