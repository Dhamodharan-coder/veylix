"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Layers, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { addEnvironment, deleteEnvironment, renameEnvironment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/icon-button";
import { notify } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

type Env = { id: string; name: string; secretCount: number };

const envHref = (projectId: string, name: string) => `/projects/${projectId}?env=${encodeURIComponent(name)}`;

/** Segmented environment switcher (shadcn Tabs look) with inline "Add environment". */
export function EnvironmentTabs({ projectId, environments, currentId }: { projectId: string; environments: Env[]; currentId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await addEnvironment(projectId, name);
      if ("error" in result) return void notify.error(result.error);
      notify.success(`Environment "${result.name}" added`);
      setAdding(false);
      setName("");
      router.push(envHref(projectId, result.name));
    });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <nav aria-label="Environments" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px]">
        {environments.map((e) => {
          const active = e.id === currentId;
          return (
            <Link
              key={e.id}
              href={envHref(projectId, e.name)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e.name}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] leading-4 tabular-nums",
                  active ? "bg-primary/10 text-primary" : "bg-background/60 text-muted-foreground",
                )}
              >
                {e.secretCount}
              </span>
            </Link>
          );
        })}
      </nav>

      {adding ? (
        <form onSubmit={submit} className="flex items-center gap-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. qa"
            autoFocus
            required
            maxLength={30}
            aria-label="New environment name"
            className="w-40 font-mono"
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <IconButton type="submit" label="Add environment" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
          </IconButton>
          <IconButton label="Cancel" disabled={pending} onClick={() => setAdding(false)}>
            <X />
          </IconButton>
        </form>
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)} className="text-muted-foreground">
          <Plus /> Add environment
        </Button>
      )}
    </div>
  );
}

/** Title of the selected environment with rename / delete controls. */
export function EnvironmentActions({ projectId, env, canDelete }: { projectId: string; env: Env; canDelete: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await renameEnvironment(env.id, renaming ?? "");
      if ("error" in result) return void notify.error(result.error);
      if (result.name !== env.name) notify.success(`Renamed "${env.name}" to "${result.name}"`);
      setRenaming(null);
      router.replace(envHref(projectId, result.name));
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete "${env.name}"?`,
      description: env.secretCount
        ? `This also deletes its ${env.secretCount} variable${env.secretCount === 1 ? "" : "s"}. This can't be undone.`
        : "This can't be undone.",
      confirmText: "Delete environment",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEnvironment(env.id);
      if (result?.error) return void notify.error(result.error);
      notify.success(`Environment "${env.name}" deleted`);
      router.replace(`/projects/${projectId}`);
    });
  };

  if (renaming !== null) {
    return (
      <form onSubmit={save} className="flex items-center gap-1">
        <Input
          value={renaming}
          onChange={(e) => setRenaming(e.target.value)}
          autoFocus
          required
          maxLength={30}
          aria-label="Environment name"
          className="w-44 font-mono"
          onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
        />
        <IconButton type="submit" label="Save" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
        </IconButton>
        <IconButton label="Cancel" disabled={pending} onClick={() => setRenaming(null)}>
          <X />
        </IconButton>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Layers className="size-5" />
      </div>
      <div>
        <div className="flex items-center gap-0.5">
          <h2 className="mr-1 font-semibold">{env.name}</h2>
          <IconButton label="Rename environment" size="icon-sm" disabled={pending} onClick={() => setRenaming(env.name)}>
            <Pencil />
          </IconButton>
          <IconButton
            label={canDelete ? "Delete environment" : "A project needs at least one environment"}
            variant="destructive-ghost"
            size="icon-sm"
            disabled={pending || !canDelete}
            onClick={remove}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          </IconButton>
        </div>
        <p className="text-sm text-muted-foreground">
          {env.secretCount} variable{env.secretCount === 1 ? "" : "s"} · encrypted with AES-256
        </p>
      </div>
    </div>
  );
}
