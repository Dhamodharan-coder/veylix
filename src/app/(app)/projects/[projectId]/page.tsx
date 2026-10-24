import { Suspense } from "react";
import { getProject } from "@/lib/projects";
import { PageHeader, formatDate } from "@/components/page";
import { ProjectPageSkeleton } from "@/components/skeletons";
import { DeleteProjectButton, SecretsPanel } from "./secrets-ui";
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
  const totalVariables = environments.reduce((n, e) => n + e.secretCount, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/dashboard" }, { label: project.name }]}
        title={project.name}
        description={`Created ${formatDate(project.createdAt)} · ${environments.length} environments · ${totalVariables} variables`}
        actions={<DeleteProjectButton projectId={project.id} name={project.name} />}
      />

      <EnvironmentTabs projectId={project.id} environments={environments} currentId={current.id} />

      <SecretsPanel
        key={current.id}
        environment={{ id: current.id, name: current.name }}
        secrets={current.secrets.map((s) => ({ id: s.id, key: s.key, updatedAt: s.updatedAt.toISOString() }))}
        header={
          <EnvironmentActions
            projectId={project.id}
            env={environments.find((e) => e.id === current.id)!}
            canDelete={environments.length > 1}
          />
        }
      />
    </>
  );
}
