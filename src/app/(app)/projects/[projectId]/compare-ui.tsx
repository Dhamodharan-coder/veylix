"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeftRight, Check, Copy, GitCompareArrows, Minus } from "lucide-react";
import { compareEnvironments, copySecrets, type CompareRow } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/page";
import { IconButton } from "@/components/icon-button";
import { TableRowsSkeleton } from "@/components/skeletons";
import { notify } from "@/components/toast";
import { cn } from "@/lib/utils";

type Env = { id: string; name: string };
type Filter = "all" | "missing" | "different" | "same";

const status = (r: CompareRow) => (!r.inA || !r.inB ? "missing" : r.same ? "same" : "different");

/** Picks a sensible second environment: production if it isn't A, otherwise the next one. */
function defaultB(environments: Env[], aId: string) {
  const others = environments.filter((e) => e.id !== aId);
  return (others.find((e) => e.name === "production") ?? others[0])?.id ?? "";
}

export function CompareButton({ environments, currentId }: { environments: Env[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  if (environments.length < 2) return null;
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-muted-foreground">
        <GitCompareArrows /> Compare
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Compare environments</DialogTitle>
            <DialogDescription>Find variables that are missing or different. Values stay hidden: they&apos;re compared on the server.</DialogDescription>
          </DialogHeader>
          {open && <CompareView environments={environments} initialA={currentId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CompareView({ environments, initialA }: { environments: Env[]; initialA: string }) {
  const [aId, setAId] = useState(initialA);
  const [bId, setBId] = useState(() => defaultB(environments, initialA));
  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [version, setVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const a = environments.find((e) => e.id === aId)!;
  const b = environments.find((e) => e.id === bId)!;

  useEffect(() => {
    let cancelled = false;
    void compareEnvironments(aId, bId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        notify.error(result.error);
        setRows([]);
      } else setRows(result.rows);
    });
    return () => {
      cancelled = true;
    };
  }, [aId, bId, version]);

  const choose = (side: "a" | "b", id: string) => {
    setRows(null);
    if (side === "a") {
      setAId(id);
      if (id === bId) setBId(aId);
    } else {
      setBId(id);
      if (id === aId) setAId(bId);
    }
  };

  const swap = () => {
    setRows(null);
    setAId(bId);
    setBId(aId);
  };

  const copy = (from: Env, to: Env, keys: string[]) =>
    startTransition(async () => {
      const result = await copySecrets(from.id, to.id, keys);
      if ("error" in result) return void notify.error(result.error);
      notify.success(`Copied ${result.copied} variable${result.copied === 1 ? "" : "s"} to ${to.name}. Check the values suit ${to.name}.`);
      setVersion((v) => v + 1);
    });

  const counts = { all: rows?.length ?? 0, missing: 0, different: 0, same: 0 };
  rows?.forEach((r) => counts[status(r)]++);
  const missingInB = rows?.filter((r) => r.inA && !r.inB).map((r) => r.key) ?? [];
  const missingInA = rows?.filter((r) => !r.inA && r.inB).map((r) => r.key) ?? [];
  const visible = rows?.filter((r) => filter === "all" || status(r) === filter) ?? [];

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <EnvSelect environments={environments} value={aId} onChange={(id) => choose("a", id)} label="First environment" />
        <IconButton label="Swap" onClick={swap}>
          <ArrowLeftRight />
        </IconButton>
        <EnvSelect environments={environments} value={bId} onChange={(id) => choose("b", id)} label="Second environment" />
      </div>

      {rows && counts.missing > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-warning/5 p-3 text-sm ring-1 ring-warning/30">
          <span className="mr-auto">
            <strong>{counts.missing}</strong> variable{counts.missing === 1 ? " is" : "s are"} missing from one side.
          </span>
          {missingInB.length > 0 && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => copy(a, b, missingInB)}>
              <Copy /> Copy {missingInB.length} to {b.name}
            </Button>
          )}
          {missingInA.length > 0 && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => copy(b, a, missingInA)}>
              <Copy /> Copy {missingInA.length} to {a.name}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-[3px] text-sm">
        {(["all", "missing", "different", "same"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium capitalize transition",
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
            <span className="tabular-nums text-xs text-muted-foreground">{rows ? counts[f] : "–"}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {rows === null ? (
          <TableRowsSkeleton rows={4} cols={["w-40", "w-16", "w-16", "w-24"]} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={rows.length === 0 ? <GitCompareArrows /> : <Check />}
            title={rows.length === 0 ? "No variables yet" : filter === "missing" ? "Nothing missing" : "Nothing here"}
            description={rows.length === 0 ? "Both environments are empty." : filter === "missing" ? `${a.name} and ${b.name} have the same keys.` : "No variables match this filter."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead className="text-center">{a.name}</TableHead>
                <TableHead className="text-center">{b.name}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const s = status(r);
                const [from, to] = r.inA ? [a, b] : [b, a];
                return (
                  <TableRow key={r.key}>
                    <TableCell className="font-mono text-[13px] break-all">{r.key}</TableCell>
                    <TableCell className="text-center">
                      <Presence present={r.inA} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Presence present={r.inB} />
                    </TableCell>
                    <TableCell>
                      {s === "missing" ? (
                        <Badge className="bg-warning/10 text-warning">Missing in {r.inA ? b.name : a.name}</Badge>
                      ) : s === "different" ? (
                        <Badge variant="secondary">Different</Badge>
                      ) : (
                        <Badge variant="outline">Same value</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s === "missing" && (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => copy(from, to, [r.key])}>
                          <Copy /> Copy to {to.name}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Copying adds the key with the same value and never overwrites an existing one. Edit the copy afterwards if {b.name} needs a different value (for
        example a live API key instead of a test key).
      </p>
    </div>
  );
}

function EnvSelect({ environments, value, onChange, label }: { environments: Env[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {environments.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const Presence = ({ present }: { present: boolean }) =>
  present ? (
    <Check className="inline size-4 text-success" aria-label="Set" />
  ) : (
    <Minus className="inline size-4 text-muted-foreground" aria-label="Missing" />
  );
