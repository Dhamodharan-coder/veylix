import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/skeleton";
import { enabledProviders } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <SignInForm providers={enabledProviders} />
    </Suspense>
  );
}
