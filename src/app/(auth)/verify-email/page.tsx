import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { emailEnabled } from "@/lib/email";
import { AuthCardSkeleton } from "@/components/skeletons";
import { VerifyEmail } from "./verify-email";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={1} />}>
      <Verify />
    </Suspense>
  );
}

async function Verify() {
  await connection();
  // No verification step while email is off.
  if (!emailEnabled) redirect("/dashboard");
  return <VerifyEmail />;
}
