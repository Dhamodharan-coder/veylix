"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Card, Input } from "@/components/ui";
import { SocialButtons } from "@/components/social-buttons";

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
      callbackURL: "/verify-email?verified=1",
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
    <Card title="Create your account" subtitle="Manage your environment variables in one place.">
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Input label="Name" name="name" required autoComplete="name" />
        <Input label="Email" name="email" type="email" required autoComplete="email" />
        <Input label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <Input label="Confirm password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        <Button disabled={pending}>{pending ? "Creating account…" : "Sign up"}</Button>
      </form>
      <p className="text-center text-sm">
        Already have an account? <Link href="/sign-in" className="underline">Sign in</Link>
      </p>
    </Card>
  );
}
