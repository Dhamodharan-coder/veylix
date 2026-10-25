"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { requireUser } from "@/lib/session";
import { assertEnvironmentOwner, DEFAULT_ENVIRONMENTS } from "@/lib/projects";
import { LIMITS, RateLimitError, enforce } from "@/lib/rate-limit";
import { generateToken } from "@/lib/api-tokens";

export type ActionState = { error?: string; ok?: boolean } | null;

/** Rate-limit check that returns an error state (shown in forms) instead of throwing. */
async function limited(name: keyof typeof LIMITS, userId: string): Promise<{ error: string } | null> {
  try {
    await enforce(name, userId);
    return null;
  } catch (e) {
    if (e instanceof RateLimitError) return { error: e.message };
    throw e;
  }
}

const keySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Keys may contain letters, digits and _, and can't start with a digit");

const envNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{0,29}$/, "Use lowercase letters, digits, - or _ (max 30 chars)");

// ---------- Projects ----------

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const name = z.string().trim().min(1).max(60).safeParse(formData.get("name"));
  if (!name.success) return { error: "Project name is required (max 60 chars)." };

  const project = await prisma.project.create({
    data: {
      name: name.data,
      ownerId: user.id,
      environments: { create: DEFAULT_ENVIRONMENTS.map((name) => ({ name })) },
    },
  });
  redirect(`/projects/${project.id}`);
}

export async function renameProject(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const name = z.string().trim().min(1).max(60).safeParse(formData.get("name"));
  if (!name.success) return { error: "Project name is required (max 60 chars)." };

  const { count } = await prisma.project.updateMany({ where: { id: projectId, ownerId: user.id }, data: { name: name.data } });
  if (!count) return { error: "Project not found." };
  refresh();
  return { ok: true };
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  await prisma.project.deleteMany({ where: { id: projectId, ownerId: user.id } });
  redirect("/dashboard");
}

// ---------- Environments ----------

type EnvActionResult = { error: string } | { name: string };

export async function addEnvironment(projectId: string, name: string): Promise<EnvActionResult> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const parsed = envNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
  if (!project) return { error: "Project not found." };

  const taken = await prisma.environment.findUnique({
    where: { projectId_name: { projectId, name: parsed.data } },
  });
  if (taken) return { error: `"${parsed.data}" already exists in this project.` };

  await prisma.environment.create({ data: { projectId, name: parsed.data } });
  refresh();
  return { name: parsed.data };
}

export async function renameEnvironment(environmentId: string, newName: string): Promise<EnvActionResult> {
  const env = await assertEnvironmentOwner(environmentId);
  const tooMany = await limited("envWrite", env.userId);
  if (tooMany) return tooMany;
  const parsed = envNameSchema.safeParse(newName);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const taken = await prisma.environment.findUnique({
    where: { projectId_name: { projectId: env.projectId, name: parsed.data } },
  });
  if (taken && taken.id !== env.id) return { error: `"${parsed.data}" already exists in this project.` };

  await prisma.environment.update({ where: { id: env.id }, data: { name: parsed.data } });
  refresh();
  return { name: parsed.data };
}

export async function deleteEnvironment(environmentId: string): Promise<ActionState> {
  const env = await assertEnvironmentOwner(environmentId);
  const tooMany = await limited("envWrite", env.userId);
  if (tooMany) return tooMany;
  const count = await prisma.environment.count({ where: { projectId: env.projectId } });
  if (count <= 1) return { error: "A project needs at least one environment." };

  await prisma.environment.delete({ where: { id: env.id } });
  refresh();
  return { ok: true };
}

// ---------- Secrets ----------

export async function upsertSecret(_: ActionState, formData: FormData): Promise<ActionState> {
  const environmentId = String(formData.get("environmentId"));
  const env = await assertEnvironmentOwner(environmentId);
  const tooMany = await limited("envWrite", env.userId);
  if (tooMany) return tooMany;

  const key = keySchema.safeParse(formData.get("key"));
  if (!key.success) return { error: key.error.issues[0].message };
  const value = String(formData.get("value") ?? "");

  await prisma.secret.upsert({
    where: { environmentId_key: { environmentId, key: key.data } },
    create: { environmentId, key: key.data, value: encrypt(value) },
    update: { value: encrypt(value) },
  });
  refresh();
  return { ok: true };
}

/** Paste a whole .env file; existing keys are overwritten. */
export async function importEnvFile(_: ActionState, formData: FormData): Promise<ActionState> {
  const environmentId = String(formData.get("environmentId"));
  const env = await assertEnvironmentOwner(environmentId);
  const tooMany = await limited("envWrite", env.userId);
  if (tooMany) return tooMany;

  const entries = parseDotenv(String(formData.get("content") ?? ""));
  if (entries.length === 0) return { error: "No KEY=value lines found." };
  const bad = entries.find(([k]) => !keySchema.safeParse(k).success);
  if (bad) return { error: `Invalid key: ${bad[0]}` };

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.secret.upsert({
        where: { environmentId_key: { environmentId, key } },
        create: { environmentId, key, value: encrypt(value) },
        update: { value: encrypt(value) },
      }),
    ),
  );
  refresh();
  return { ok: true };
}

/** Edit an existing variable: change its value and/or rename its key. */
export async function updateSecret(secretId: string, key: string, value: string): Promise<ActionState> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const secret = await prisma.secret.findFirst({
    where: { id: secretId, environment: { project: { ownerId: user.id } } },
    select: { environmentId: true, key: true },
  });
  if (!secret) return { error: "Variable not found." };

  const parsed = keySchema.safeParse(key);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data !== secret.key) {
    const taken = await prisma.secret.findUnique({
      where: { environmentId_key: { environmentId: secret.environmentId, key: parsed.data } },
      select: { id: true },
    });
    if (taken) return { error: `${parsed.data} already exists in this environment.` };
  }

  await prisma.secret.update({
    where: { id: secretId },
    data: { key: parsed.data, value: encrypt(value) },
  });
  refresh();
  return { ok: true };
}

export async function deleteSecret(secretId: string) {
  const user = await requireUser();
  await enforce("envWrite", user.id);
  await prisma.secret.deleteMany({
    where: { id: secretId, environment: { project: { ownerId: user.id } } },
  });
  refresh();
}

export async function revealSecret(secretId: string): Promise<string> {
  const user = await requireUser();
  await enforce("envReveal", user.id);
  const secret = await prisma.secret.findFirst({
    where: { id: secretId, environment: { project: { ownerId: user.id } } },
    select: { value: true },
  });
  if (!secret) throw new Error("Secret not found");
  return decrypt(secret.value);
}

/** Returns the environment as .env file text. */
export async function exportEnvFile(environmentId: string): Promise<string> {
  const env = await assertEnvironmentOwner(environmentId);
  await enforce("envExport", env.userId);
  const secrets = await prisma.secret.findMany({
    where: { environmentId },
    orderBy: { key: "asc" },
  });
  return secrets.map((s) => `${s.key}=${JSON.stringify(decrypt(s.value))}`).join("\n") + "\n";
}

function parseDotenv(content: string): [string, string][] {
  const out = new Map<string, string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2];
    const quoted = value.match(/^(['"])([\s\S]*)\1$/);
    if (quoted) {
      value = quoted[2];
      if (quoted[1] === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out.set(match[1], value);
  }
  return [...out];
}

// ---------- API tokens (CLI / CI) ----------

const tokenInput = z.object({
  name: z.string().trim().min(1, "Give the token a name").max(60),
  /** null = all of the user's projects */
  projectId: z.string().nullable(),
  environmentId: z.string().nullable(),
  access: z.enum(["READ", "READ_WRITE"]),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable(),
});

/**
 * Creates a token. Requests are authenticated by its hash; the value itself is
 * kept encrypted (like variable values) so the owner can copy it again later.
 */
export async function createApiToken(input: z.input<typeof tokenInput>): Promise<{ token: string } | { error: string }> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const parsed = tokenInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, ownerId: user.id },
      select: { environments: { select: { id: true } } },
    });
    if (!project) return { error: "Project not found." };
    if (data.environmentId && !project.environments.some((e) => e.id === data.environmentId)) return { error: "Environment not found." };
  } else if (data.environmentId) return { error: "Choose a project to limit the token to one environment." };

  const { token, tokenHash, prefix } = generateToken();
  await prisma.apiToken.create({
    data: {
      name: data.name,
      tokenHash,
      encryptedToken: encrypt(token),
      prefix,
      userId: user.id,
      projectId: data.projectId,
      environmentId: data.environmentId,
      access: data.access,
      expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null,
    },
  });
  refresh();
  return { token };
}

export async function revokeApiToken(tokenId: string) {
  const user = await requireUser();
  await prisma.apiToken.deleteMany({ where: { id: tokenId, userId: user.id } });
  refresh();
}

/** Returns a token's value so its owner can copy it again. */
export async function revealApiToken(tokenId: string): Promise<{ token: string } | { error: string }> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const row = await prisma.apiToken.findFirst({ where: { id: tokenId, userId: user.id }, select: { encryptedToken: true } });
  if (!row) return { error: "Token not found." };
  if (!row.encryptedToken) return { error: "This token was created before copying was supported. Regenerate it to get a copyable value." };
  return { token: decrypt(row.encryptedToken) };
}

/**
 * Issues a new secret for an existing token (same name, scope, access and
 * expiry); the old value stops working immediately.
 */
export async function regenerateApiToken(tokenId: string): Promise<{ token: string } | { error: string }> {
  const user = await requireUser();
  const tooMany = await limited("envWrite", user.id);
  if (tooMany) return tooMany;
  const existing = await prisma.apiToken.findFirst({ where: { id: tokenId, userId: user.id }, select: { id: true } });
  if (!existing) return { error: "Token not found." };
  const { token, tokenHash, prefix } = generateToken();
  await prisma.apiToken.update({ where: { id: existing.id }, data: { tokenHash, encryptedToken: encrypt(token), prefix, lastUsedAt: null } });
  refresh();
  return { token };
}
