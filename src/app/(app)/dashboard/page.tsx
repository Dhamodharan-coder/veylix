import Link from "next/link";
import { Suspense } from "react";
import { listProjects } from "@/lib/projects";
import { ProjectListSkeleton } from "@/components/skeleton";
import { CreateProjectForm } from "./create-project-form";

export default function DashboardPage() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <CreateProjectForm />
      </div>
      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectList />
      </Suspense>
    </>
  );
}

async function ProjectList() {
  const projects = await listProjects();
  if (projects.length === 0) {
    return <p className="rounded-lg border border-dashed border-black/20 p-8 text-center opacity-70 dark:border-white/20">No projects yet. Create your first one above.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Link href={`/projects/${p.id}`} className="block rounded-lg border border-black/10 p-4 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40">
            <div className="font-medium">{p.name}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-70">
              {p.environments.map((e) => (
                <span key={e.id} className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                  {e.name}: {e._count.secrets}
                </span>
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
