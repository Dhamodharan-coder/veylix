import { Suspense } from "react";
import { connection } from "next/server";
import { AuthCardSkeleton } from "@/components/skeletons";
import { enabledProviders } from "@/lib/auth";
import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={4} />}>
      <SignUp />
    </Suspense>
  );
}

async function SignUp() {
  // Read OAuth config at request time so one build works in any environment.
  await connection();
  return <SignUpForm providers={enabledProviders} />;
}
