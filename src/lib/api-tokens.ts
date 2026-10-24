import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LIMITS, hit } from "@/lib/rate-limit";
import type { ApiTokenAccess } from "@/generated/prisma/client";

// Env Manager API tokens (for the `veylix` CLI and CI). Format: "vlx_" + 43
// base64url chars (256 bits). Only a SHA-256 hash is stored.

export const TOKEN_PREFIX = "vlx_";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashToken(token), prefix: token.slice(0, 8) };
}

export type AuthedToken = {
  id: string;
  userId: string;
  access: ApiTokenAccess;
  project: { id: string; name: string };
  /** Environments this token may use (all of the project's, or the one it's scoped to). */
  environments: { id: string; name: string }[];
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
    include: {
      project: { select: { id: true, name: true, ownerId: true, environments: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } } } },
      environment: { select: { id: true, name: true } },
    },
  });
  // Revoked tokens are deleted; a token also dies if its creator no longer owns the project.
  if (!record || record.project.ownerId !== record.userId) throw new ApiError(401, "Invalid API token");
  if (record.expiresAt && record.expiresAt < new Date()) throw new ApiError(401, "This API token has expired");

  const { allowed, retryAfter } = await hit(`apiToken:${record.id}`, LIMITS.apiToken);
  if (!allowed) throw new ApiError(429, "Too many requests", { "Retry-After": String(retryAfter) });

  // Record usage at most once a minute to avoid a write per request.
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }

  return {
    id: record.id,
    userId: record.userId,
    access: record.access,
    project: { id: record.project.id, name: record.project.name },
    environments: record.environment ? [record.environment] : record.project.environments,
  };
}

/** Picks the environment for a request: `?env=` or the token's only environment. */
export function resolveEnvironment(auth: AuthedToken, name: string | null) {
  if (!name) {
    if (auth.environments.length === 1) return auth.environments[0]!;
    throw new ApiError(400, `Specify an environment with ?env= (one of: ${auth.environments.map((e) => e.name).join(", ")})`);
  }
  const env = auth.environments.find((e) => e.name === name.toLowerCase());
  if (!env) throw new ApiError(404, `Environment "${name}" not found or not allowed for this token`);
  return env;
}

export function requireWrite(auth: AuthedToken) {
  if (auth.access !== "READ_WRITE") throw new ApiError(403, "This token is read-only");
}

/** .env text in the same format as the web app's export. */
export const toDotenv = (secrets: Record<string, string>) =>
  Object.entries(secrets)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n";
