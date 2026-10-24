import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/skeletons";
import { enabledProviders } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <SignInForm providers={enabledProviders} emailEnabled={emailEnabled} />
    </Suspense>
  );
}
