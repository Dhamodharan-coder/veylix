"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/page";
import { AuthCardSkeleton } from "@/components/skeletons";
import { AuthPanel, FormMessage, authLink } from "../auth-panel";

// Verified links go straight to /dashboard. This page handles:
//  ?error=...       → the email link was invalid/expired
//  ?email=...       → just signed up, waiting for the user to click the link
//  ?verified=1      → legacy links; forwarded to the dashboard
export function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const verified = Boolean(params.get("verified") && !params.get("error"));

  useEffect(() => {
    if (verified) router.replace("/dashboard");
  }, [verified, router]);

  if (verified) return <AuthCardSkeleton fields={1} />;

  async function resend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await authClient.sendVerificationEmail({
      email: String(new FormData(e.currentTarget).get("email")),
      callbackURL: "/dashboard",
    });
    setStatus(error ? "error" : "sent");
  }

  const linkFailed = Boolean(params.get("error"));

  return (
    <AuthPanel
      title={linkFailed ? "Link expired" : "Check your inbox"}
      subtitle={linkFailed
        ? "That verification link is invalid or has expired. Request a new one below."
        : "We sent a verification link to your email. Click it to activate your account."}
    >
      {status === "sent" && <FormMessage tone="success">New verification email sent.</FormMessage>}
      {status === "error" && <FormMessage>Couldn&apos;t send the email. Try again in a minute.</FormMessage>}
      <form onSubmit={resend} className="grid gap-4">
        <Field label="Email" name="email" type="email" required defaultValue={params.get("email") ?? ""} />
        <Button size="lg" variant="outline" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Resend verification email"}
        </Button>
      </form>
      <Link href="/sign-in" className={`text-center text-sm ${authLink}`}>Back to sign in</Link>
    </AuthPanel>
  );
}
