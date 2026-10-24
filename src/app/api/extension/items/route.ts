import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createItem } from "@/app/(app)/vault/actions";
import { extensionOriginOk } from "@/lib/extension-api";

const body = z.object({
  folderId: z.string().min(1),
  name: z.string(),
  url: z.string().nullable(),
  encryptedItemKey: z.string(),
  encryptedData: z.string(),
});

/**
 * POST /api/extension/items: save a login captured by the extension. The item
 * is encrypted in the extension; this reuses the vault's createItem action
 * (permission checks, validation, rate limits and audit included).
 */
export async function POST(request: NextRequest) {
  if (!extensionOriginOk(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await auth.api.getSession({ headers: await headers() }))) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const res = await createItem({ ...parsed.data, type: "LOGIN", tags: [] });
  return NextResponse.json(res, { status: res.ok ? 201 : 400 });
}
