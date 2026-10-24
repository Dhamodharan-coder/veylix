import { redirect } from "next/navigation";
import { emailEnabled } from "@/lib/email";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  // Password reset is delivered by email, so it's unavailable while email is off.
  if (!emailEnabled) redirect("/sign-in");
  return <ForgotPasswordForm />;
}
