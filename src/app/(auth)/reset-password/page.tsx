import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/skeleton";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
