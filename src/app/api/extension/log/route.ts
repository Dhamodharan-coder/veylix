import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logVaultAccess } from "@/app/(app)/vault/actions";

const body = z.object({
  action: z.enum(["AUTOFILLED", "PASSWORD_COPIED", "USERNAME_COPIED", "URL_OPENED", "EXTENSION_UNLOCKED"]),
  itemId: z.string().optional(),
});

/** Audit events reported by the browser extension (decryption happens there). */
export async function POST(request: NextRequest) {
  // Only accept calls from the extension or the app itself.
  const origin = request.headers.get("origin") ?? "";
  if (origin && !origin.startsWith("chrome-extension://") && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const res = await logVaultAccess(parsed.data.action, parsed.data.itemId);
  return NextResponse.json(res, { status: res.ok ? 200 : 403 });
}
