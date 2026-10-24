import Link from "next/link";
import { Suspense } from "react";
import { getProject } from "@/lib/projects";
import { ProjectPageSkeleton } from "@/components/skeleton";
import { DeleteProjectButton, EnvToolbar, SecretForm, SecretRow } from "./secrets-ui";
import { EnvironmentActions, EnvironmentTabs } from "./environment-ui";

export default function ProjectPage(props: PageProps<"/projects/[projectId]">) {
  return (
    <Suspense fallback={<ProjectPageSkeleton />}>
      <Project {...props} />
    </Suspense>
  );
}

async function Project({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { env } = await searchParams;
  const project = await getProject(projectId);
  const current = project.environments.find((e) => e.name === env) ?? project.environments[0];
  const environments = project.environments.map((e) => ({ id: e.id, name: e.name, secretCount: e.secrets.length }));

  return (
    <>
      <Link href="/dashboard" className="text-sm opacity-60 hover:opacity-100">← Projects</Link>
      <div className="mt-2 mb-6 flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
        <DeleteProjectButton projectId={project.id} name={project.name} />
      </div>

      <EnvironmentTabs projectId={project.id} environments={environments} currentId={current.id} />

      <EnvToolbar
        environmentId={current.id}
        envName={current.name}
        left={
          <EnvironmentActions
            key={current.id}
            projectId={project.id}
            env={environments.find((e) => e.id === current.id)!}
            canDelete={environments.length > 1}
          />
        }
      />
      <SecretForm environmentId={current.id} />

      {current.secrets.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-black/20 p-8 text-center opacity-70 dark:border-white/20">
          No variables in <b>{current.name}</b> yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {current.secrets.map((s) => (
            <SecretRow key={s.id} id={s.id} name={s.key} />
          ))}
        </ul>
      )}
    </>
  );
}
