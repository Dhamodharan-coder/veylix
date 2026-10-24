import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { emailEnabled } from "@/lib/email";
import { AuthCardSkeleton } from "@/components/skeletons";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={1} />}>
      <ForgotPassword />
    </Suspense>
  );
}

async function ForgotPassword() {
  await connection();
  // Password reset is delivered by email, so it's unavailable while email is off.
  if (!emailEnabled) redirect("/sign-in");
  return <ForgotPasswordForm />;
}
