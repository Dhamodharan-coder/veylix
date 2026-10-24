import { Suspense } from "react";
import { FolderKanban, KeyRound, Layers } from "lucide-react";
import { listProjects } from "@/lib/projects";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page";
import { DashboardSkeleton } from "@/components/skeletons";
import { NewProjectButton } from "./new-project-button";
import { ProjectTable } from "./project-table";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage encrypted environment variables for each of your applications."
        actions={<NewProjectButton />}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const projects = await listProjects();
  const environments = projects.reduce((n, p) => n + p.environments.length, 0);
  const variables = projects.reduce((n, p) => n + p.environments.reduce((m, e) => m + e._count.secrets, 0), 0);

  const stats = [
    { label: "Projects", value: projects.length, hint: "Applications you manage", icon: FolderKanban },
    { label: "Environments", value: environments, hint: "Across all projects", icon: Layers },
    { label: "Variables", value: variables, hint: "Encrypted with AES-256", icon: KeyRound },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label} className="bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription className="flex items-center justify-between">
                {label}
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <ProjectTable
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt.toISOString(),
          environments: p.environments.map((e) => ({ name: e.name, count: e._count.secrets })),
        }))}
      />
    </div>
  );
}
