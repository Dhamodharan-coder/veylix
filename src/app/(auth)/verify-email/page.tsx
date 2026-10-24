import { Suspense } from "react";
import { redirect } from "next/navigation";
import { emailEnabled } from "@/lib/email";
import { AuthCardSkeleton } from "@/components/skeletons";
import { VerifyEmail } from "./verify-email";

export default function VerifyEmailPage() {
  // No verification step while email is off.
  if (!emailEnabled) redirect("/dashboard");
  return (
    <Suspense fallback={<AuthCardSkeleton fields={1} />}>
      <VerifyEmail />
    </Suspense>
  );
}
