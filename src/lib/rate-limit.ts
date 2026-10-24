import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

// Fixed-window rate limiting for server actions and API routes. Counters live
// in Postgres (the same `rate_limit` table Better Auth uses, with an "app:"
// key prefix), so limits hold across serverless instances.

export type Rule = { max: number; windowSec: number };

/** Limits per action, per user unless noted. */
export const LIMITS = {
  vaultReset: { max: 5, windowSec: 15 * 60 }, // verifies the login password
  vaultKeyChange: { max: 10, windowSec: 60 * 60 }, // master password / recovery key changes
  findRecipient: { max: 30, windowSec: 60 }, // email lookups (enumeration)
  share: { max: 30, windowSec: 10 * 60 },
  vaultWrite: { max: 120, windowSec: 60 },
  vaultAccessLog: { max: 300, windowSec: 60 },
  extensionRead: { max: 60, windowSec: 60 },
  envReveal: { max: 120, windowSec: 60 },
  envExport: { max: 30, windowSec: 60 },
  envWrite: { max: 120, windowSec: 60 },
  apiToken: { max: 120, windowSec: 60 }, // per API token (CLI / CI)
} satisfies Record<string, Rule>;

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Too many attempts. Please try again in ${formatWait(retryAfter)}.`);
    this.name = "RateLimitError";
  }
}

const formatWait = (s: number) => (s < 60 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.ceil(s / 60)} minute${Math.ceil(s / 60) === 1 ? "" : "s"}`);

/** Counts one hit for `key`; returns whether it's allowed and when the window resets. */
export async function hit(key: string, rule: Rule): Promise<{ allowed: boolean; retryAfter: number }> {
  if (process.env.RATE_LIMIT_ENABLED === "false") return { allowed: true, retryAfter: 0 };
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  // One atomic upsert: start a new window if the old one expired, else increment.
  const [row] = await prisma.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "rate_limit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${`app:${key}`}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit"."lastRequest" <= ${now - windowMs} THEN 1 ELSE "rate_limit"."count" + 1 END,
      "lastRequest" = CASE WHEN "rate_limit"."lastRequest" <= ${now - windowMs} THEN ${now} ELSE "rate_limit"."lastRequest" END
    RETURNING "count", "lastRequest"`;
  const retryAfter = Math.max(1, Math.ceil((Number(row!.lastRequest) + windowMs - now) / 1000));
  return { allowed: row!.count <= rule.max, retryAfter };
}

/** Throws RateLimitError when the limit for `name` is exceeded for this subject. */
export async function enforce(name: keyof typeof LIMITS, subject: string): Promise<void> {
  const { allowed, retryAfter } = await hit(`${name}:${subject}`, LIMITS[name]);
  if (!allowed) throw new RateLimitError(retryAfter);
}
