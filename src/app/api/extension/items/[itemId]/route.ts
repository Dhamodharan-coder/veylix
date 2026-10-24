import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateItem } from "@/app/(app)/vault/actions";
import { extensionOriginOk } from "@/lib/extension-api";

const body = z.object({ encryptedData: z.string(), passwordChanged: z.boolean() });

/**
 * PATCH /api/extension/items/:itemId: update a login's encrypted data (e.g. a
 * changed password the extension detected). Name/URL/tags stay as they are.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/extension/items/[itemId]">) {
  if (!extensionOriginOk(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await auth.api.getSession({ headers: await headers() }))) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { itemId } = await params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // updateItem re-checks MODIFY permission; this lookup only preserves metadata.
  const item = await prisma.vaultItem.findUnique({ where: { id: itemId }, select: { name: true, url: true, tags: true } });
  if (!item) return NextResponse.json({ ok: false, error: "Login not found" }, { status: 404 });

  const res = await updateItem(itemId, { name: item.name, url: item.url, tags: item.tags, ...parsed.data });
  return NextResponse.json(res, { status: res.ok ? 200 : 403 });
}
