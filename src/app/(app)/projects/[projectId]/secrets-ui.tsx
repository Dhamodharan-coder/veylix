"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, Copy, Eye, EyeOff, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import {
  deleteProject,
  deleteSecret,
  exportEnvFile,
  importEnvFile,
  revealSecret,
  updateSecret,
  upsertSecret,
  type ActionState,
} from "@/app/actions";
import { Button, IconButton } from "@/components/ui";
import { notify } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/60";

const iconSize = 16;

export function SecretForm({ environmentId }: { environmentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await upsertSecret(prev, formData);
    if (result?.ok) {
      notify.success(`${String(formData.get("key")).trim()} saved`);
      formRef.current?.reset();
    }
    return result;
  }, null);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="environmentId" value={environmentId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="key" required placeholder="KEY_NAME" className={`${inputClass} sm:w-1/3`} />
        <input name="value" placeholder="value" autoComplete="off" className={`${inputClass} flex-1`} />
        <Button disabled={pending}>{pending ? "Saving…" : "Add / update"}</Button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function SecretRow({ id, name }: { id: string; name: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  // Runs a server call, turning thrown errors into an error toast.
  const run = (fn: () => Promise<void>, failMessage: string) =>
    startTransition(async () => {
      try {
        await fn();
      } catch {
        notify.error(failMessage);
      }
    });

  const toggle = () =>
    run(async () => setValue(value === null ? await revealSecret(id) : null), `Couldn't reveal ${name}`);

  const copy = () =>
    run(async () => {
      await navigator.clipboard.writeText(value ?? (await revealSecret(id)));
      setCopied(true);
      notify.success(`${name} copied to clipboard`);
      setTimeout(() => setCopied(false), 1500);
    }, `Couldn't copy ${name}`);

  const startEdit = () =>
    run(async () => {
      setEditError(null);
      setEditing({ key: name, value: value ?? (await revealSecret(id)) });
    }, `Couldn't load ${name}`);

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "This variable will be permanently removed from this environment.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    run(async () => {
      await deleteSecret(id);
      notify.success(`${name} deleted`);
    }, `Couldn't delete ${name}`);
  };

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    run(async () => {
      const result = await updateSecret(id, editing.key, editing.value);
      if (result?.error) return setEditError(result.error);
      notify.success(`${editing.key.trim()} updated`);
      setEditing(null);
      setValue(null);
    }, `Couldn't update ${name}`);
  };

  if (editing) {
    return (
      <li className="p-3">
        <form onSubmit={save} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={editing.key}
              onChange={(e) => setEditing({ ...editing, key: e.target.value })}
              required
              aria-label="Key"
              className={`${inputClass} sm:w-1/3`}
            />
            <input
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              autoFocus
              autoComplete="off"
              aria-label="Value"
              className={`${inputClass} flex-1`}
            />
            <div className="flex gap-1">
              <IconButton type="submit" label="Save" disabled={pending}>
                {pending ? <LoaderCircle size={iconSize} className="animate-spin" /> : <Check size={iconSize} />}
              </IconButton>
              <IconButton label="Cancel" disabled={pending} onClick={() => setEditing(null)}>
                <X size={iconSize} />
              </IconButton>
            </div>
          </div>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <span className="font-mono text-sm font-medium sm:w-1/3 sm:truncate">{name}</span>
      <span className="flex-1 truncate font-mono text-sm opacity-70">{value ?? "••••••••••••"}</span>
      <div className="flex gap-1">
        <IconButton label={value === null ? "Show value" : "Hide value"} onClick={toggle} disabled={pending}>
          {value === null ? <Eye size={iconSize} /> : <EyeOff size={iconSize} />}
        </IconButton>
        <IconButton label="Copy value" onClick={copy} disabled={pending}>
          {copied ? <Check size={iconSize} className="text-green-600" /> : <Copy size={iconSize} />}
        </IconButton>
        <IconButton label="Edit" onClick={startEdit} disabled={pending}>
          <Pencil size={iconSize} />
        </IconButton>
        <IconButton label="Delete" variant="danger" onClick={remove} disabled={pending}>
          <Trash2 size={iconSize} />
        </IconButton>
      </div>
    </li>
  );
}

export function EnvToolbar({ environmentId, envName, left }: { environmentId: string; envName: string; left?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await importEnvFile(prev, formData);
    if (result?.ok) {
      notify.success(`Imported into ${envName}`);
      setOpen(false);
    }
    return result;
  }, null);
  const [exporting, startExport] = useTransition();

  const download = () =>
    startExport(async () => {
      try {
        const text = await exportEnvFile(environmentId);
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: `.env.${envName}` });
        a.click();
        URL.revokeObjectURL(url);
        notify.success(`Downloaded .env.${envName}`);
      } catch {
        notify.error("Couldn't export this environment");
      }
    });

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {left}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen(!open)}>{open ? "Cancel import" : "Import .env"}</Button>
          <Button variant="outline" onClick={download} disabled={exporting}>{exporting ? "Preparing…" : "Download .env"}</Button>
        </div>
      </div>
      {open && (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="environmentId" value={environmentId} />
          <textarea
            name="content"
            rows={8}
            required
            placeholder={"# Paste your .env file\nDATABASE_URL=postgres://...\nAPI_KEY=abc123"}
            className={inputClass}
          />
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button disabled={pending} className="self-start">{pending ? "Importing…" : `Import into ${envName}`}</Button>
        </form>
      )}
    </div>
  );
}

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: "Delete this project?",
          description: "All environments and variables in this project will be permanently deleted. This can't be undone.",
          confirmText: "Delete project",
          tone: "danger",
          requireText: name,
        });
        if (!ok) return;
        startTransition(async () => {
          notify.info(`Deleting ${name}…`);
          await deleteProject(projectId);
        });
      }}
    >
      <span className="inline-flex items-center gap-1.5"><Trash2 size={iconSize} /> Delete project</span>
    </Button>
  );
}
