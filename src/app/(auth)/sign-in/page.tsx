import { Suspense } from "react";
import { connection } from "next/server";
import { AuthCardSkeleton } from "@/components/skeletons";
import { enabledProviders } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <SignIn />
    </Suspense>
  );
}

async function SignIn() {
  // Read OAuth/email config at request time so one build works in any environment.
  await connection();
  return <SignInForm providers={enabledProviders} emailEnabled={emailEnabled} />;
}
