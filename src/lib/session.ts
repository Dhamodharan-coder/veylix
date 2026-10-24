import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type CurrentUser = { id: string; name: string; email: string };

/** Data Access Layer entry point: the verified user, or redirect to sign-in. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { id, name, email } = session.user;
  return { id, name, email };
}
