"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, formatDate } from "@/components/page";
import { IconButton } from "@/components/icon-button";
import { notify } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

type Secret = { id: string; key: string; updatedAt: string };
type Environment = { id: string; name: string };

/** Card with toolbar (search, import, export, add) and the variables table. */
export function SecretsPanel({ environment, secrets, header }: { environment: Environment; secrets: Secret[]; header: ReactNode }) {
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [exporting, startExport] = useTransition();
  const filtered = secrets.filter((s) => s.key.toLowerCase().includes(query.trim().toLowerCase()));

  const download = () =>
    startExport(async () => {
      try {
        const text = await exportEnvFile(environment.id);
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: `.env.${environment.name}` });
        a.click();
        URL.revokeObjectURL(url);
        notify.success(`Downloaded .env.${environment.name}`);
      } catch {
        notify.error("Couldn't export this environment");
      }
    });

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        {header}
        <div className="flex flex-wrap items-center gap-2">
          {secrets.length > 0 && (
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search keys…" aria-label="Search keys" className="pl-8" />
            </div>
          )}
          <Button variant="outline" onClick={() => setDialog("import")}>
            <Upload /> Import
          </Button>
          <Button variant="outline" onClick={download} disabled={exporting || secrets.length === 0}>
            {exporting ? <LoaderCircle className="animate-spin" /> : <Download />} Export
          </Button>
          <Button onClick={() => setDialog("add")}>
            <Plus /> Add variable
          </Button>
        </div>
      </div>

      {secrets.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title={`No variables in ${environment.name}`}
          description="Add variables one by one, or import an existing .env file."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialog("import")}><Upload /> Import .env</Button>
              <Button onClick={() => setDialog("add")}><Plus /> Add variable</Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="px-4 py-14 text-center text-sm text-muted-foreground">No keys match &ldquo;{query}&rdquo;.</p>
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[32%] pl-4">Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="hidden w-36 md:table-cell">Updated</TableHead>
              <TableHead className="w-44 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <SecretRow key={s.id} secret={s} />
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialog === "add"} onOpenChange={(o) => setDialog(o ? "add" : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add variable</DialogTitle>
            <DialogDescription>
              Saved encrypted to <span className="font-medium text-foreground">{environment.name}</span>. An existing key is overwritten.
            </DialogDescription>
          </DialogHeader>
          {dialog === "add" && <AddVariableForm environment={environment} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "import"} onOpenChange={(o) => setDialog(o ? "import" : null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import .env file</DialogTitle>
            <DialogDescription>
              Paste the contents of a .env file into <span className="font-medium text-foreground">{environment.name}</span>. Existing keys are overwritten.
            </DialogDescription>
          </DialogHeader>
          {dialog === "import" && <ImportForm environment={environment} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function AddVariableForm({ environment, onDone }: { environment: Environment; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await upsertSecret(prev, formData);
    if (result?.ok) {
      notify.success(`${String(formData.get("key")).trim()} saved`);
      onDone();
    }
    return result;
  }, null);

  return (
    <form action={action} className="grid gap-4">
      <FormError message={state?.error} />
      <input type="hidden" name="environmentId" value={environment.id} />
      <div className="grid gap-2">
        <Label htmlFor="secret-key">Key</Label>
        <Input id="secret-key" name="key" required autoFocus placeholder="DATABASE_URL" className="font-mono" />
        <p className="text-xs text-muted-foreground">Letters, digits and underscores.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="secret-value">Value</Label>
        <Textarea id="secret-value" name="value" rows={3} autoComplete="off" placeholder="postgres://…" className="field-sizing-fixed h-24 max-h-60 resize-y font-mono break-all" />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={pending}>{pending ? "Saving…" : "Save variable"}</Button>
      </DialogFooter>
    </form>
  );
}

function ImportForm({ environment, onDone }: { environment: Environment; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await importEnvFile(prev, formData);
    if (result?.ok) {
      notify.success(`Imported into ${environment.name}`);
      onDone();
    }
    return result;
  }, null);

  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Read the file in the browser and show it for review before importing.
  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_ENV_FILE_BYTES) return notify.error("File is too large", { description: "The limit is 1 MB." });
    const text = await file.text();
    if (text.includes("\u0000")) return notify.error("That doesn't look like a text .env file");
    setContent(text);
    setFileName(file.name);
  };

  const lineCount = content.split(/\r?\n/).filter((l) => /^\s*(export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(l)).length;

  return (
    <form action={action} className="grid gap-4">
      <FormError message={state?.error} />
      <input type="hidden" name="environmentId" value={environment.id} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void loadFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileUp className="size-5" />
        </span>
        <p className="text-sm">
          <span className="font-medium">Drop a .env file here</span> <span className="text-muted-foreground">or</span>{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => fileInput.current?.click()}>
            choose a file
          </button>
        </p>
        <p className="text-xs text-muted-foreground">.env, .env.local, .env.production, .txt · up to 1 MB · read on your device</p>
        <input
          ref={fileInput}
          type="file"
          accept=".env,.txt,text/plain,*"
          className="hidden"
          onChange={(e) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{fileName ? "Review before importing" : "Or paste the contents"}</span>
          {fileName && (
            <span className="flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">· {lineCount} variable{lineCount === 1 ? "" : "s"}</span>
              <button
                type="button"
                aria-label="Clear file"
                className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setContent("");
                  setFileName(null);
                }}
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}
        </div>
        <Textarea
          name="content"
          rows={10}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          aria-label=".env contents"
          placeholder={"# Paste your .env file\nDATABASE_URL=postgres://...\nAPI_KEY=abc123"}
          wrap="off"
          className="field-sizing-fixed h-64 max-h-[45vh] resize-y overflow-auto font-mono text-[13px] leading-relaxed whitespace-pre"
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={pending || !content.trim()}>
          {pending ? "Importing…" : lineCount ? `Import ${lineCount} variable${lineCount === 1 ? "" : "s"}` : "Import variables"}
        </Button>
      </DialogFooter>
    </form>
  );
}

const MAX_ENV_FILE_BYTES = 1024 * 1024;

function SecretRow({ secret }: { secret: Secret }) {
  const { id, key: name } = secret;
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
      <TableRow className="bg-primary/5 hover:bg-primary/5">
        <TableCell colSpan={4} className="px-4 py-3">
          <form onSubmit={save} className="grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={editing.key}
                onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                required
                aria-label="Key"
                className="font-mono sm:w-[30%]"
              />
              <Input
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                autoFocus
                autoComplete="off"
                aria-label="Value"
                className="flex-1 font-mono"
                onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
              />
              <div className="flex gap-2">
                <Button disabled={pending}>
                  {pending ? <LoaderCircle className="animate-spin" /> : <Check />} Save
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>
                  <X /> Cancel
                </Button>
              </div>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="py-3 pl-4 font-mono text-[13px] font-medium">
        <span className="block max-w-[28ch] truncate" title={name}>{name}</span>
      </TableCell>
      <TableCell className="font-mono text-[13px]">
        {value === null ? (
          <span className="tracking-widest text-muted-foreground select-none">••••••••••••</span>
        ) : (
          <span className="block max-w-[48ch] truncate" title={value}>
            {value || <i className="text-muted-foreground">empty</i>}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(secret.updatedAt)}</TableCell>
      <TableCell className="pr-4">
        <div className="flex justify-end gap-0.5">
          <IconButton label={value === null ? "Show value" : "Hide value"} onClick={toggle} disabled={pending}>
            {value === null ? <Eye /> : <EyeOff />}
          </IconButton>
          <IconButton label="Copy value" onClick={copy} disabled={pending}>
            {copied ? <Check className="text-success" /> : <Copy />}
          </IconButton>
          <IconButton label="Edit" onClick={startEdit} disabled={pending}>
            <Pencil />
          </IconButton>
          <IconButton label="Delete" variant="destructive-ghost" onClick={remove} disabled={pending}>
            <Trash2 />
          </IconButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  return (
    <Button
      variant="destructive"
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
      <Trash2 /> Delete project
    </Button>
  );
}
