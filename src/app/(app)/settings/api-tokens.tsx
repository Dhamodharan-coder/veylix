"use client";

import { useState, useTransition } from "react";
import { Check, CircleAlert, Copy, Eye, EyeOff, KeyRound, LoaderCircle, Plus, RefreshCw, ShieldCheck, Terminal, Trash2 } from "lucide-react";
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
import { createApiToken, regenerateApiToken, revealApiToken, revokeApiToken } from "@/app/actions";

export type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  /** false for tokens created before values were kept (they must be regenerated) */
  copyable: boolean;
  /** null = all of the user's projects */
  projectId: string | null;
  projectName: string | null;
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
  const [viewing, setViewing] = useState<TokenRow | null>(null);
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
        <CardDescription>
          Use the Veylix CLI or REST API to pull variables into apps and CI pipelines.{" "}
          <a href="/docs/cli" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
            Read the docs
          </a>
        </CardDescription>
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
              <TableHead className="w-24 pr-6" />
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
                    <p className="text-sm">{t.projectName ?? "All projects"}</p>
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
                    <div className="flex justify-end gap-0.5">
                      <IconButton label="View token & CLI usage" onClick={() => setViewing(t)}>
                        <Eye />
                      </IconButton>
                      <IconButton label="Revoke token" variant="destructive-ghost" onClick={() => revoke(t)}>
                        <Trash2 />
                      </IconButton>
                    </div>
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
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && <ViewToken key={viewing.id} token={viewing} onClose={() => setViewing(null)} />}
        </DialogContent>
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

/** CLI commands for a token; `token` may be a placeholder when the real value isn't known. */
function cliCommands(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    `veylix login --url ${origin} --token ${token}`,
    "veylix link              # pick a project & environment for this folder",
    "veylix pull > .env",
    "veylix run -- npm start",
  ].join("\n");
}

function CliHelp({ token }: { token: string }) {
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Terminal className="size-4" /> Use it with the CLI
      </p>
      <CopyBlock label="Copy commands" text={cliCommands(token)} />
      <p className="text-xs text-muted-foreground">
        Run <code className="font-mono">veylix projects</code> to list everything the token can reach, or pass{" "}
        <code className="font-mono">--project</code> / <code className="font-mono">--env</code> to any command. In CI, set{" "}
        <code className="font-mono">VEYLIX_TOKEN</code>, <code className="font-mono">VEYLIX_URL</code>, <code className="font-mono">VEYLIX_PROJECT</code> and{" "}
        <code className="font-mono">VEYLIX_ENV</code> instead.{" "}
        <a href="/docs/cli/commands" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
          All commands
        </a>
      </p>
    </div>
  );
}

/** Shows a freshly issued token once, with copy-ready CLI commands. */
function TokenRevealed({ title, token, onClose }: { title: string; token: string; onClose: () => void }) {
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Copy it now, or any time later from the token&apos;s View button.</DialogDescription>
      </DialogHeader>
      <CopyBlock text={token} label="Copy token" />
      <CliHelp token={token} />
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </div>
  );
}

/** The token value, masked until revealed; fetched from the server only when asked for. */
function TokenValue({ token, value, onValue }: { token: TokenRow; value: string | null; onValue: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (value) return value;
    setLoading(true);
    const res = await revealApiToken(token.id);
    setLoading(false);
    if ("error" in res) {
      notify.error(res.error);
      return null;
    }
    onValue(res.token);
    return res.token;
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/70 py-1.5 pr-1.5 pl-3 ring-1 ring-foreground/10">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{shown && value ? value : `${token.prefix}${"•".repeat(24)}`}</code>
      <IconButton
        label={shown ? "Hide token" : "Show token"}
        size="icon-sm"
        disabled={loading}
        onClick={async () => {
          if (shown) return setShown(false);
          if (await load()) setShown(true);
        }}
      >
        {loading ? <LoaderCircle className="animate-spin" /> : shown ? <EyeOff /> : <Eye />}
      </IconButton>
      <IconButton
        label="Copy token"
        size="icon-sm"
        disabled={loading}
        onClick={async () => {
          const v = await load();
          if (!v) return;
          await navigator.clipboard.writeText(v);
          setCopied(true);
          notify.success("Token copied");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </IconButton>
    </div>
  );
}

/** Token details, the copyable value and CLI usage, plus Regenerate to rotate it. */
function ViewToken({ token, onClose }: { token: TokenRow; onClose: () => void }) {
  const confirm = useConfirm();
  const [issued, setIssued] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (issued) return <TokenRevealed title="New token value" token={issued} onClose={onClose} />;

  const regenerate = async () => {
    const ok = await confirm({
      title: `Regenerate "${token.name}"?`,
      description: "You'll get a new token value with the same project, access and expiry. The current value stops working immediately, so update it anywhere it's used.",
      confirmText: "Regenerate",
      tone: "danger",
    });
    if (!ok) return;
    setPending(true);
    const res = await regenerateApiToken(token.id);
    setPending(false);
    if ("error" in res) return notify.error(res.error);
    setIssued(res.token);
  };

  const details: [string, React.ReactNode][] = [
    ["Project", token.projectName ?? "All projects"],
    ["Environment", token.environmentName ?? "All environments"],
    ["Access", token.access === "READ_WRITE" ? "Read & write" : "Read only"],
    ["Created", formatDate(token.createdAt)],
    ["Last used", token.lastUsedAt ? formatDate(token.lastUsedAt) : "Never"],
    ["Expires", token.expiresAt ? formatDate(token.expiresAt) : "Never"],
  ];

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> {token.name}
        </DialogTitle>
        <DialogDescription>Token details and how to use it.</DialogDescription>
      </DialogHeader>

      {token.copyable ? (
        <div className="grid gap-2">
          <Label>Token</Label>
          <TokenValue token={token} value={value} onValue={setValue} />
        </div>
      ) : (
        <Alert>
          <ShieldCheck />
          <AlertDescription>
            This token was created before copying was supported, so its value can&apos;t be shown. Regenerate it once to get a value you can copy any time.
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-muted/50 p-4 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <CliHelp token={value ?? "<your-token>"} />

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={regenerate} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Regenerate token
        </Button>
      </DialogFooter>
    </div>
  );
}

function CreateTokenForm({ projects, onClose }: { projects: ProjectOption[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [environmentId, setEnvironmentId] = useState("all");
  const [access, setAccess] = useState<"READ" | "READ_WRITE">("READ");
  const [expires, setExpires] = useState("90");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = projects.find((p) => p.id === projectId);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createApiToken({
      name,
      projectId: projectId === "all" ? null : projectId,
      environmentId: environmentId === "all" ? null : environmentId,
      access,
      expiresInDays: expires === "never" ? null : (Number(expires) as 30 | 90 | 365),
    });
    setPending(false);
    if ("error" in res) return setError(res.error);
    setToken(res.token);
  };

  if (token) return <TokenRevealed title="Token created" token={token} onClose={onClose} />;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Create API token
        </DialogTitle>
        <DialogDescription>Use one token for all your projects and pick the project and environment in the CLI, or limit it to one project.</DialogDescription>
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
              <SelectItem value="all">All projects</SelectItem>
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
          <Select value={environmentId} onValueChange={setEnvironmentId} disabled={!project}>
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
        <Button disabled={pending || !name.trim()}>{pending ? <><LoaderCircle className="animate-spin" /> Creating…</> : "Create token"}</Button>
      </DialogFooter>
    </form>
  );
}
