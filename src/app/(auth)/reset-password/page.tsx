import { Suspense } from "react";
import { redirect } from "next/navigation";
import { emailEnabled } from "@/lib/email";
import { AuthCardSkeleton } from "@/components/skeletons";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  // Password reset is delivered by email, so it's unavailable while email is off.
  if (!emailEnabled) redirect("/sign-in");
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
