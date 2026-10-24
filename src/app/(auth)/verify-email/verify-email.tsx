"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Card, Input } from "@/components/ui";

// Three states:
//  ?verified=1      → arrived from a valid email link (now signed in)
//  ?error=...       → the email link was invalid/expired
//  ?email=...       → just signed up, waiting for the user to click the link
export function VerifyEmail() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (params.get("verified") && !params.get("error")) {
    return (
      <Card title="Email verified 🎉" subtitle="Your account is ready.">
        <Link href="/dashboard" className="rounded-md bg-foreground px-4 py-2 text-center text-sm font-medium text-background">
          Go to dashboard
        </Link>
      </Card>
    );
  }

  async function resend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await authClient.sendVerificationEmail({
      email: String(new FormData(e.currentTarget).get("email")),
      callbackURL: "/verify-email?verified=1",
    });
    setStatus(error ? "error" : "sent");
  }

  const linkFailed = Boolean(params.get("error"));

  return (
    <Card
      title={linkFailed ? "Link expired" : "Check your inbox"}
      subtitle={linkFailed
        ? "That verification link is invalid or has expired. Request a new one below."
        : "We sent a verification link to your email. Click it to activate your account."}
    >
      {status === "sent" && <Alert tone="success">New verification email sent.</Alert>}
      {status === "error" && <Alert>Couldn&apos;t send the email. Try again in a minute.</Alert>}
      <form onSubmit={resend} className="flex flex-col gap-4">
        <Input label="Email" name="email" type="email" required defaultValue={params.get("email") ?? ""} />
        <Button variant="outline" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Resend verification email"}
        </Button>
      </form>
      <Link href="/sign-in" className="text-center text-sm underline">Back to sign in</Link>
    </Card>
  );
}
