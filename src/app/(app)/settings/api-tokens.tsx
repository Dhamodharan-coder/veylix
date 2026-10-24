"use client";

import { useState, useTransition } from "react";
import { Check, CircleAlert, Copy, KeyRound, LoaderCircle, Plus, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, formatDate } from "@/components/page";
import { IconButton } from "@/components/icon-button";
import { useConfirm } from "@/components/confirm-dialog";
import { notify } from "@/components/toast";
import { createApiToken, revokeApiToken } from "@/app/actions";

export type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  projectName: string;
  environmentName: string | null;
  access: "READ" | "READ_WRITE";
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type ProjectOption = { id: string; name: string; environments: { id: string; name: string }[] };

export function ApiTokensCard({ tokens, projects }: { tokens: TokenRow[]; projects: ProjectOption[] }) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const revoke = async (t: TokenRow) => {
    const ok = await confirm({
      title: `Revoke "${t.name}"?`,
      description: "Anything using this token (CLI, CI pipelines, servers) will immediately lose access.",
      confirmText: "Revoke token",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      await revokeApiToken(t.id);
      notify.success(`Token "${t.name}" revoked`);
    });
  };

  return (
    <Card className="gap-0 shadow-xs">
      <CardHeader className="pb-4">
        <CardTitle>API tokens</CardTitle>
        <CardDescription>Use the Veylix CLI or REST API to pull variables into apps and CI pipelines.</CardDescription>
        <CardAction>
          <Button onClick={() => setOpen(true)} disabled={projects.length === 0}>
            <Plus /> Create token
          </Button>
        </CardAction>
      </CardHeader>

      {tokens.length === 0 ? (
        <EmptyState
          icon={<Terminal />}
          title="No API tokens yet"
          description={projects.length ? "Create a token to use `veylix pull` or `veylix run` with one of your projects." : "Create a project first, then make a token for it."}
        />
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Token</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="hidden md:table-cell">Last used</TableHead>
              <TableHead className="hidden md:table-cell">Expires</TableHead>
              <TableHead className="w-12 pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => {
              const expired = t.expiresAt && new Date(t.expiresAt) < new Date();
              return (
                <TableRow key={t.id}>
                  <TableCell className="py-3 pl-6">
                    <p className="font-medium">{t.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{t.prefix}…</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{t.projectName}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">{t.environmentName ?? "All environments"}</Badge>
                      <Badge variant={t.access === "READ_WRITE" ? "default" : "outline"}>{t.access === "READ_WRITE" ? "Read & write" : "Read only"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{t.lastUsedAt ? formatDate(t.lastUsedAt) : "Never"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {expired ? <Badge variant="destructive">Expired</Badge> : <span className="text-muted-foreground">{t.expiresAt ? formatDate(t.expiresAt) : "Never"}</span>}
                  </TableCell>
                  <TableCell className="pr-6">
                    <IconButton label="Revoke token" variant="destructive-ghost" onClick={() => revoke(t)}>
                      <Trash2 />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">{open && <CreateTokenForm projects={projects} onClose={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </Card>
  );
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/70 p-3 ring-1 ring-foreground/10">
      <code className="min-w-0 flex-1 font-mono text-[13px] break-all whitespace-pre-wrap">{text}</code>
      <IconButton
        label={label}
        size="icon-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </IconButton>
    </div>
  );
}

function CreateTokenForm({ projects, onClose }: { projects: ProjectOption[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [environmentId, setEnvironmentId] = useState("all");
  const [access, setAccess] = useState<"READ" | "READ_WRITE">("READ");
  const [expires, setExpires] = useState("90");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = projects.find((p) => p.id === projectId);
  const envName = project?.environments.find((e) => e.id === environmentId)?.name;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createApiToken({
      name,
      projectId,
      environmentId: environmentId === "all" ? null : environmentId,
      access,
      expiresInDays: expires === "never" ? null : (Number(expires) as 30 | 90 | 365),
    });
    setPending(false);
    if ("error" in res) return setError(res.error);
    setToken(res.token);
  };

  if (token) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const env = envName ?? project?.environments[0]?.name ?? "development";
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Token created</DialogTitle>
          <DialogDescription>Copy it now. For your security it won&apos;t be shown again.</DialogDescription>
        </DialogHeader>
        <CopyBlock text={token} label="Copy token" />
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Terminal className="size-4" /> Use it with the CLI
          </p>
          <CopyBlock label="Copy commands" text={`veylix login --url ${origin} --token ${token}\nveylix pull --env ${env} > .env\nveylix run --env ${env} -- npm start`} />
          <p className="text-xs text-muted-foreground">
            In CI, set <code className="font-mono">VEYLIX_TOKEN</code> and <code className="font-mono">VEYLIX_URL</code> as secrets instead of running <code className="font-mono">login</code>.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Create API token
        </DialogTitle>
        <DialogDescription>Tokens give programmatic access to one project&apos;s variables.</DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor="token-name">Name</Label>
        <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub Actions deploy" required maxLength={60} autoFocus />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Project</Label>
          <Select
            value={projectId}
            onValueChange={(v) => {
              setProjectId(v);
              setEnvironmentId("all");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Environment</Label>
          <Select value={environmentId} onValueChange={setEnvironmentId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All environments</SelectItem>
              {project?.environments.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Access</Label>
          <Select value={access} onValueChange={(v) => setAccess(v as typeof access)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="READ">Read only (pull / run)</SelectItem>
              <SelectItem value="READ_WRITE">Read &amp; write (also push / set)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Expires</Label>
          <Select value={expires} onValueChange={setExpires}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">In 30 days</SelectItem>
              <SelectItem value="90">In 90 days</SelectItem>
              <SelectItem value="365">In 1 year</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={pending || !name.trim() || !projectId}>{pending ? <><LoaderCircle className="animate-spin" /> Creating…</> : "Create token"}</Button>
      </DialogFooter>
    </form>
  );
}
