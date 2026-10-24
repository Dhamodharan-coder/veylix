import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getVaultAccount, loadVaultSnapshot } from "@/lib/vault-data";
import { LIMITS, hit } from "@/lib/rate-limit";

/**
 * Vault data for the browser extension: the user's sealed keys and the same
 * ciphertext snapshot the web app receives. Nothing here is decryptable
 * without the master password, which never leaves the extension.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { allowed, retryAfter } = await hit(`extensionRead:${session.user.id}`, LIMITS.extensionRead);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

  const account = await getVaultAccount();
  const snapshot = account ? await loadVaultSnapshot() : null;

  return NextResponse.json(
    { user: { name: session.user.name, email: session.user.email }, account, snapshot },
    { headers: { "Cache-Control": "no-store" } },
  );
}
