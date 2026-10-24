import { enabledProviders } from "@/lib/auth";
import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return <SignUpForm providers={enabledProviders} />;
}
