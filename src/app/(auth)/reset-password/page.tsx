import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { emailEnabled } from "@/lib/email";
import { AuthCardSkeleton } from "@/components/skeletons";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <ResetPassword />
    </Suspense>
  );
}

async function ResetPassword() {
  await connection();
  // Password reset is delivered by email, so it's unavailable while email is off.
  if (!emailEnabled) redirect("/sign-in");
  return <ResetPasswordForm />;
}
