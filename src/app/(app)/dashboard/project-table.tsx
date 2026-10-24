"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FolderKanban, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, formatDate } from "@/components/page";
import { NewProjectButton } from "./new-project-button";

type Row = {
  id: string;
  name: string;
  createdAt: string;
  environments: { name: string; count: number }[];
};

export function ProjectTable({ projects }: { projects: Row[] }) {
  const [query, setQuery] = useState("");
  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-semibold">All projects</h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"} in your workspace
          </p>
        </div>
        {projects.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="pl-8"
            />
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create a project to start storing environment variables for development, staging and production."
          action={<NewProjectButton />}
        />
      ) : filtered.length === 0 ? (
        <p className="px-4 py-14 text-center text-sm text-muted-foreground">No projects match &ldquo;{query}&rdquo;.</p>
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Project</TableHead>
              <TableHead>Environments</TableHead>
              <TableHead className="text-right">Variables</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const total = p.environments.reduce((n, e) => n + e.count, 0);
              return (
                <TableRow key={p.id} className="group relative">
                  <TableCell className="py-3 pl-4">
                    {/* Stretched link makes the whole row clickable */}
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 font-medium after:absolute after:inset-0">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary uppercase">
                        {p.name.slice(0, 2)}
                      </span>
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {p.environments.map((e) => (
                        <Badge key={e.name} variant="secondary" className="font-normal">
                          {e.name}
                          <span className="text-muted-foreground tabular-nums">{e.count}</span>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{total}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(p.createdAt)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    <ChevronRight className="size-4 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
