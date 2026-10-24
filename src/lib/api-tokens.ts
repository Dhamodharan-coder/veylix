import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LIMITS, hit } from "@/lib/rate-limit";
import type { ApiTokenAccess } from "@/generated/prisma/client";

// Env Manager API tokens (for the `veylix` CLI and CI). Format: "vlx_" + 43
// base64url chars (256 bits). Requests are matched by SHA-256 hash; the value is also kept AES-encrypted so the owner can copy it again.

export const TOKEN_PREFIX = "vlx_";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashToken(token), prefix: token.slice(0, 8) };
}

type ProjectScope = { id: string; name: string; environments: { id: string; name: string }[] };

export type AuthedToken = {
  id: string;
  userId: string;
  access: ApiTokenAccess;
  /** true when the token covers every project the user owns */
  allProjects: boolean;
  /** Projects (and their environments) this token may use. */
  projects: ProjectScope[];
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public headers?: Record<string, string>) {
    super(message);
  }
}

/** Turns an ApiError into a JSON response; anything else is rethrown for Next.js to handle. */
export const apiErrorResponse = (e: unknown) => {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers: e.headers });
  throw e;
};

/** Validates `Authorization: Bearer vlx_…`, rate-limits, and returns the token's scope. */
export async function authenticateToken(request: Request): Promise<AuthedToken> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith(TOKEN_PREFIX)) throw new ApiError(401, "Missing or invalid API token (Authorization: Bearer vlx_…)");

  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { environment: { select: { id: true, name: true } } },
  });
  if (!record) throw new ApiError(401, "Invalid API token");
  if (record.expiresAt && record.expiresAt < new Date()) throw new ApiError(401, "This API token has expired");

  const { allowed, retryAfter } = await hit(`apiToken:${record.id}`, LIMITS.apiToken);
  if (!allowed) throw new ApiError(429, "Too many requests", { "Retry-After": String(retryAfter) });

  // Always scoped to projects the token's creator owns, so a token dies with ownership.
  const projects = await prisma.project.findMany({
    where: { ownerId: record.userId, ...(record.projectId ? { id: record.projectId } : {}) },
    select: { id: true, name: true, environments: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { name: "asc" },
  });
  if (record.projectId && !projects.length) throw new ApiError(401, "Invalid API token");

  // Record usage at most once a minute to avoid a write per request.
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }

  return {
    id: record.id,
    userId: record.userId,
    access: record.access,
    allProjects: !record.projectId,
    projects: record.environment ? projects.map((p) => ({ ...p, environments: [record.environment!] })) : projects,
  };
}

const names = (items: { name: string }[]) => items.map((i) => i.name).join(", ");

/**
 * Picks the project and environment for a request. `project` matches an id or
 * a name (case-insensitive) and may be omitted when only one project is in
 * scope; likewise `env` when the project has a single environment.
 */
export function resolveTarget(auth: AuthedToken, projectRef: string | null | undefined, envName: string | null | undefined) {
  let project: ProjectScope | undefined;
  if (projectRef) {
    const ref = projectRef.trim().toLowerCase();
    project = auth.projects.find((p) => p.id === projectRef) ?? auth.projects.find((p) => p.name.toLowerCase() === ref);
    if (!project) throw new ApiError(404, `Project "${projectRef}" not found or not allowed for this token`);
  } else if (auth.projects.length === 1) {
    project = auth.projects[0]!;
  } else if (!auth.projects.length) {
    throw new ApiError(404, "You don't have any projects yet");
  } else {
    throw new ApiError(400, `Specify a project (one of: ${names(auth.projects)}). Tip: run \`veylix link\``);
  }

  if (!envName) {
    if (project.environments.length === 1) return { project, environment: project.environments[0]! };
    throw new ApiError(400, `Specify an environment for ${project.name} (one of: ${names(project.environments)})`);
  }
  const environment = project.environments.find((e) => e.name === envName.trim().toLowerCase());
  if (!environment) throw new ApiError(404, `Environment "${envName}" not found in ${project.name} or not allowed for this token`);
  return { project, environment };
}

export function requireWrite(auth: AuthedToken) {
  if (auth.access !== "READ_WRITE") throw new ApiError(403, "This token is read-only");
}

/** .env text in the same format as the web app's export. */
export const toDotenv = (secrets: Record<string, string>) =>
  Object.entries(secrets)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n";
