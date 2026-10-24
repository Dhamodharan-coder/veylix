import { NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse, authenticateToken } from "@/lib/api-tokens";

/** GET /api/v1/me: who the token belongs to and which projects/environments it can use (`veylix whoami`, `projects`, `link`). */
export async function GET(request: Request) {
  await connection(); // always dynamic: depends on the Authorization header
  try {
    const auth = await authenticateToken(request);
    const envIds = auth.projects.flatMap((p) => p.environments.map((e) => e.id));
    const [user, counts] = await Promise.all([
      prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true, email: true } }),
      prisma.secret.groupBy({ by: ["environmentId"], where: { environmentId: { in: envIds } }, _count: true }),
    ]);
    const countOf = new Map(counts.map((c) => [c.environmentId, c._count]));
    return NextResponse.json({
      user,
      access: auth.access === "READ_WRITE" ? "read-write" : "read",
      scope: auth.allProjects ? "all-projects" : "project",
      projects: auth.projects.map((p) => ({
        id: p.id,
        name: p.name,
        environments: p.environments.map((e) => ({ name: e.name, variables: countOf.get(e.id) ?? 0 })),
      })),
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
