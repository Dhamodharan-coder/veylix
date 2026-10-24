import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page";
import { ProfileSkeleton } from "@/components/skeletons";
import { ProfileForm } from "./profile-form";
import { AppearanceSettings } from "./appearance";
import { ApiTokensCard } from "./api-tokens";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account, preferences and API access." />
      <div className="flex max-w-3xl flex-col gap-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <Profile />
        </Suspense>
        <Suspense fallback={<ProfileSkeleton />}>
          <ApiTokens />
        </Suspense>
        <AppearanceSettings />
      </div>
    </>
  );
}

async function Profile() {
  const user = await requireUser();
  return <ProfileForm name={user.name} email={user.email} />;
}

async function ApiTokens() {
  const user = await requireUser();
  const [tokens, projects] = await Promise.all([
    prisma.apiToken.findMany({
      where: { userId: user.id },
      include: { project: { select: { name: true } }, environment: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, environments: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <ApiTokensCard
      projects={projects}
      tokens={tokens.map((t) => ({
        id: t.id,
        name: t.name,
        prefix: t.prefix,
        copyable: t.encryptedToken !== null,
        projectId: t.projectId,
        projectName: t.project?.name ?? null,
        environmentName: t.environment?.name ?? null,
        access: t.access,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
