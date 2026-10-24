"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { addEnvironment, deleteEnvironment, renameEnvironment } from "@/app/actions";
import { IconButton } from "@/components/ui";
import { notify } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

type Env = { id: string; name: string; secretCount: number };

const inputClass =
  "w-40 rounded-md border border-black/15 bg-transparent px-2 py-1 font-mono text-sm outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/60";

const envHref = (projectId: string, name: string) => `/projects/${projectId}?env=${encodeURIComponent(name)}`;

/** Environment tabs with an inline "+" to add a new environment. */
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
    <nav className="mb-4 flex items-end gap-1 overflow-x-auto border-b border-black/10 dark:border-white/15">
      {environments.map((e) => (
        <Link
          key={e.id}
          href={envHref(projectId, e.name)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
            e.id === currentId ? "border-foreground font-medium" : "border-transparent opacity-60 hover:opacity-100"
          }`}
        >
          {e.name} <span className="opacity-50">({e.secretCount})</span>
        </Link>
      ))}

      {adding ? (
        <form onSubmit={submit} className="mb-1 flex items-center gap-1 pl-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. qa"
            autoFocus
            required
            maxLength={30}
            aria-label="New environment name"
            className={inputClass}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <IconButton type="submit" label="Add environment" disabled={pending}>
            {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
          </IconButton>
          <IconButton label="Cancel" disabled={pending} onClick={() => setAdding(false)}>
            <X size={16} />
          </IconButton>
        </form>
      ) : (
        <IconButton label="New environment" className="mb-1 ml-1" onClick={() => setAdding(true)}>
          <Plus size={16} />
        </IconButton>
      )}
    </nav>
  );
}

/** Name of the selected environment with rename / delete controls. */
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
        <input
          value={renaming}
          onChange={(e) => setRenaming(e.target.value)}
          autoFocus
          required
          maxLength={30}
          aria-label="Environment name"
          className={inputClass}
          onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
        />
        <IconButton type="submit" label="Save" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
        </IconButton>
        <IconButton label="Cancel" disabled={pending} onClick={() => setRenaming(null)}>
          <X size={16} />
        </IconButton>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 font-mono text-sm font-medium">{env.name}</span>
      <IconButton label="Rename environment" disabled={pending} onClick={() => setRenaming(env.name)}>
        <Pencil size={16} />
      </IconButton>
      <IconButton
        label={canDelete ? "Delete environment" : "A project needs at least one environment"}
        variant="danger"
        disabled={pending || !canDelete}
        onClick={remove}
      >
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </IconButton>
    </div>
  );
}
