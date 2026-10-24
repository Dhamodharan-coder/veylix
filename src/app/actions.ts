"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { requireUser } from "@/lib/session";
import { assertEnvironmentOwner, DEFAULT_ENVIRONMENTS } from "@/lib/projects";

export type ActionState = { error?: string; ok?: boolean } | null;

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

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  await prisma.project.deleteMany({ where: { id: projectId, ownerId: user.id } });
  redirect("/dashboard");
}

// ---------- Environments ----------

type EnvActionResult = { error: string } | { name: string };

export async function addEnvironment(projectId: string, name: string): Promise<EnvActionResult> {
  const user = await requireUser();
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
  const count = await prisma.environment.count({ where: { projectId: env.projectId } });
  if (count <= 1) return { error: "A project needs at least one environment." };

  await prisma.environment.delete({ where: { id: env.id } });
  refresh();
  return { ok: true };
}

// ---------- Secrets ----------

export async function upsertSecret(_: ActionState, formData: FormData): Promise<ActionState> {
  const environmentId = String(formData.get("environmentId"));
  await assertEnvironmentOwner(environmentId);

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
  await assertEnvironmentOwner(environmentId);

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
  await prisma.secret.deleteMany({
    where: { id: secretId, environment: { project: { ownerId: user.id } } },
  });
  refresh();
}

export async function revealSecret(secretId: string): Promise<string> {
  const user = await requireUser();
  const secret = await prisma.secret.findFirst({
    where: { id: secretId, environment: { project: { ownerId: user.id } } },
    select: { value: true },
  });
  if (!secret) throw new Error("Secret not found");
  return decrypt(secret.value);
}

/** Returns the environment as .env file text. */
export async function exportEnvFile(environmentId: string): Promise<string> {
  await assertEnvironmentOwner(environmentId);
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
