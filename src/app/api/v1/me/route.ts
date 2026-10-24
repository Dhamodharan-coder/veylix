import { NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse, authenticateToken } from "@/lib/api-tokens";

/** GET /api/v1/me: what this token can access (used by `veylix whoami` / `veylix envs`). */
export async function GET(request: Request) {
  await connection(); // always dynamic: depends on the Authorization header
  try {
    const auth = await authenticateToken(request);
    const counts = await prisma.secret.groupBy({
      by: ["environmentId"],
      where: { environmentId: { in: auth.environments.map((e) => e.id) } },
      _count: true,
    });
    const countOf = new Map(counts.map((c) => [c.environmentId, c._count]));
    return NextResponse.json({
      project: auth.project,
      access: auth.access === "READ_WRITE" ? "read-write" : "read",
      environments: auth.environments.map((e) => ({ name: e.name, variables: countOf.get(e.id) ?? 0 })),
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
