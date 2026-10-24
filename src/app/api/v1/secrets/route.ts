import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { ApiError, apiErrorResponse, authenticateToken, requireWrite, resolveTarget, toDotenv } from "@/lib/api-tokens";

// Env Manager REST API for the `veylix` CLI and CI pipelines.
// Auth: Authorization: Bearer vlx_…   (token for all projects, or one project / environment)
// Target: ?project=<name|id>&env=<name> (body fields for PUT); either may be omitted when unambiguous.

const keySchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Keys may contain letters, digits and _, and can't start with a digit");

async function readSecrets(environmentId: string) {
  const rows = await prisma.secret.findMany({ where: { environmentId }, orderBy: { key: "asc" } });
  return Object.fromEntries(rows.map((s) => [s.key, decrypt(s.value)]));
}

/** GET /api/v1/secrets?project=api&env=production&format=json|dotenv */
export async function GET(request: Request) {
  await connection(); // always dynamic: depends on the Authorization header
  try {
    const auth = await authenticateToken(request);
    const url = new URL(request.url);
    const { project, environment: env } = resolveTarget(auth, url.searchParams.get("project"), url.searchParams.get("env"));
    const secrets = await readSecrets(env.id);

    if (url.searchParams.get("format") === "dotenv") {
      return new NextResponse(toDotenv(secrets), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ project: project.name, environment: env.name, secrets }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

const putBody = z.object({
  project: z.string().optional(),
  env: z.string().optional(),
  secrets: z
    .record(z.string(), z.string().max(100_000))
    .refine((s) => Object.keys(s).length <= 1000, "At most 1000 variables per request")
    .superRefine((s, ctx) => {
      const bad = Object.keys(s).find((k) => !keySchema.safeParse(k).success);
      if (bad) ctx.addIssue({ code: "custom", message: `Invalid key "${bad}": use letters, digits and _, not starting with a digit` });
    }),
  /** true = make the environment exactly match `secrets` (delete keys not listed). */
  replace: z.boolean().optional(),
});

/** PUT /api/v1/secrets  { project, env, secrets: { KEY: "value" }, replace? }: upsert (read-write tokens). */
export async function PUT(request: Request) {
  await connection(); // always dynamic: depends on the Authorization header
  try {
    const auth = await authenticateToken(request);
    requireWrite(auth);
    const parsed = putBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid body");
    const { project, environment: env } = resolveTarget(auth, parsed.data.project, parsed.data.env);
    const entries = Object.entries(parsed.data.secrets);

    const existing = await prisma.secret.findMany({ where: { environmentId: env.id }, select: { key: true } });
    const toDelete = parsed.data.replace ? existing.map((s) => s.key).filter((k) => !(k in parsed.data.secrets)) : [];
    await prisma.$transaction([
      ...entries.map(([key, value]) =>
        prisma.secret.upsert({
          where: { environmentId_key: { environmentId: env.id, key } },
          create: { environmentId: env.id, key, value: encrypt(value) },
          update: { value: encrypt(value) },
        }),
      ),
      ...(toDelete.length ? [prisma.secret.deleteMany({ where: { environmentId: env.id, key: { in: toDelete } } })] : []),
    ]);
    const existingKeys = new Set(existing.map((s) => s.key));
    return NextResponse.json({
      project: project.name,
      environment: env.name,
      created: entries.filter(([k]) => !existingKeys.has(k)).length,
      updated: entries.filter(([k]) => existingKeys.has(k)).length,
      deleted: toDelete.length,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

/** DELETE /api/v1/secrets?project=api&env=production&key=API_KEY (read-write tokens). */
export async function DELETE(request: Request) {
  await connection(); // always dynamic: depends on the Authorization header
  try {
    const auth = await authenticateToken(request);
    requireWrite(auth);
    const url = new URL(request.url);
    const { project, environment: env } = resolveTarget(auth, url.searchParams.get("project"), url.searchParams.get("env"));
    const key = keySchema.safeParse(url.searchParams.get("key"));
    if (!key.success) throw new ApiError(400, "Specify a valid ?key=");
    const { count } = await prisma.secret.deleteMany({ where: { environmentId: env.id, key: key.data } });
    if (!count) throw new ApiError(404, `${key.data} not found in ${env.name}`);
    return NextResponse.json({ project: project.name, environment: env.name, deleted: key.data });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
