import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/skeleton";
import { VerifyEmail } from "./verify-email";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={1} />}>
      <VerifyEmail />
    </Suspense>
  );
}
