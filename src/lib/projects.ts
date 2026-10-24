import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

// Every query here resolves the user first and scopes by ownerId,
// so callers can never read another user's data by passing an id.

/** Every new project starts with these; users can add/rename/delete afterwards. */
export const DEFAULT_ENVIRONMENTS = ["development", "staging", "production"];

export async function listProjects() {
  const user = await requireUser();
  return prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      environments: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { secrets: true } } },
      },
    },
  });
}

export async function getProject(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    include: {
      environments: {
        orderBy: { createdAt: "asc" },
        include: { secrets: { orderBy: { key: "asc" }, select: { id: true, key: true, updatedAt: true } } },
      },
    },
  });
  if (!project) notFound();
  return project;
}

/** Throws unless the environment belongs to a project owned by the current user. */
export async function assertEnvironmentOwner(environmentId: string) {
  const user = await requireUser();
  const env = await prisma.environment.findFirst({
    where: { id: environmentId, project: { ownerId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!env) throw new Error("Environment not found");
  return { ...env, userId: user.id };
}
