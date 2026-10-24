"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Copy, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, formatDate } from "@/components/page";
import { DashboardSkeleton } from "@/components/skeletons";
import { ItemDialog, type ItemDialogMode } from "@/components/vault/item-dialog";
import { PERMISSION_LABEL, avatarColor, hostname, useDecrypted } from "@/components/vault/use-decrypted";
import { passwordStrength } from "@/lib/password-strength";
import { sha256Hex } from "@/lib/vault-crypto";
import { formatBreachCount, pwnedCount } from "@/lib/breach-check";
import type { VaultSnapshot, VaultItemRecord } from "@/lib/vault-data";
import type { getAccessOverview } from "@/app/(app)/vault/actions";
import { cn } from "@/lib/utils";

type Overview = Extract<Awaited<ReturnType<typeof getAccessOverview>>, { ok: true }>;

const OLD_DAYS = 90;
const DAY = 86_400_000;

export function ReportsView({ snapshot, overview }: { snapshot: VaultSnapshot; overview: Overview | null }) {
  const { folders, items } = snapshot;
  const logins = useMemo(() => items.filter((i) => i.type === "LOGIN"), [items]);
  const { secrets, ready } = useDecrypted(logins, folders);
  const [hashes, setHashes] = useState<Map<string, string> | null>(null);
  const [dialog, setDialog] = useState<ItemDialogMode | null>(null);
  // Reports are evaluated against the moment the page was opened.
  const [now] = useState(() => Date.now());
  // itemId → times seen in breaches (Have I Been Pwned, k-anonymity); "error" if the check failed.
  const [breaches, setBreaches] = useState<Map<string, number> | "error" | null>(null);

  // Compare passwords by hash in memory to find reuse without keeping copies around.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all(
      logins.map(async (i) => {
        const s = secrets.get(i.id);
        return [i.id, s && s !== "error" && s.password ? await sha256Hex(s.password) : ""] as const;
      }),
    ).then((entries) => !cancelled && setHashes(new Map(entries)));
    return () => {
      cancelled = true;
    };
  }, [ready, logins, secrets]);

  // Check each distinct password once against known data breaches.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const passwords = new Map<string, string[]>();
    for (const i of logins) {
      const s = secrets.get(i.id);
      if (s && s !== "error" && s.password) passwords.set(s.password, [...(passwords.get(s.password) ?? []), i.id]);
    }
    Promise.all([...passwords].map(async ([pw, ids]) => ({ ids, count: await pwnedCount(pw) })))
      .then((results) => {
        if (cancelled) return;
        setBreaches(new Map(results.flatMap(({ ids, count }) => ids.map((id) => [id, count] as const))));
      })
      .catch(() => !cancelled && setBreaches("error"));
    return () => {
      cancelled = true;
    };
  }, [ready, logins, secrets]);

  const report = useMemo(() => {
    if (!hashes) return null;
    const withPassword = logins.filter((i) => hashes.get(i.id));
    const weak = withPassword
      .map((i) => {
        const s = secrets.get(i.id);
        const strength = passwordStrength(s && s !== "error" ? s.password : "");
        return { item: i, strength };
      })
      .filter((w) => w.strength.score <= 1);

    const groups = new Map<string, VaultItemRecord[]>();
    for (const i of withPassword) {
      const h = hashes.get(i.id)!;
      groups.set(h, [...(groups.get(h) ?? []), i]);
    }
    const reused = [...groups.values()].filter((g) => g.length > 1);
    const old = withPassword
      .map((i) => ({ item: i, days: Math.floor((now - new Date(i.passwordUpdatedAt).getTime()) / DAY) }))
      .filter((o) => o.days >= OLD_DAYS)
      .sort((a, b) => b.days - a.days);

    const breached =
      breaches instanceof Map
        ? withPassword.map((i) => ({ item: i, count: breaches.get(i.id) ?? 0 })).filter((b) => b.count > 0).sort((a, b) => b.count - a.count)
        : [];

    const atRisk = new Set([
      ...weak.map((w) => w.item.id),
      ...reused.flat().map((i) => i.id),
      ...old.map((o) => o.item.id),
      ...breached.map((b) => b.item.id),
    ]);
    const score = withPassword.length ? Math.round(100 * (1 - atRisk.size / withPassword.length)) : 100;
    return { total: withPassword.length, weak, reused, reusedCount: reused.flat().length, old, breached, score, shared: items.filter((i) => i.shared).length };
  }, [hashes, logins, secrets, items, now, breaches]);

  const open = (item: VaultItemRecord) => {
    const s = secrets.get(item.id);
    if (s && s !== "error") setDialog({ kind: "edit", item, secret: s });
  };

  if (!report) {
    return (
      <>
        <PageHeader title="Security Reports" description="Find weak, reused and old passwords, and review who has access." />
        <DashboardSkeleton />
      </>
    );
  }

  const scoreTone = report.score >= 80 ? "text-success" : report.score >= 50 ? "text-warning" : "text-destructive";
  const stats = [
    { label: "Weak passwords", value: report.weak.length, icon: ShieldX, tone: "text-destructive bg-destructive/10" },
    { label: "Reused passwords", value: report.reusedCount, icon: Copy, tone: "text-warning bg-warning/10" },
    { label: `Older than ${OLD_DAYS} days`, value: report.old.length, icon: CalendarClock, tone: "text-warning bg-warning/10" },
    {
      label: "Found in breaches",
      value: breaches === null ? "…" : breaches === "error" ? "?" : report.breached.length,
      icon: ShieldAlert,
      tone: "text-destructive bg-destructive/10",
    },
  ];

  return (
    <>
      <PageHeader title="Security Reports" description="Analysed in your browser. Decrypted passwords never leave this device." />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <Card className="shadow-xs">
          <CardHeader className="gap-3">
            <CardDescription className="flex items-center gap-2">
              {report.score >= 80 ? <ShieldCheck className="size-4 text-success" /> : <ShieldAlert className={cn("size-4", scoreTone)} />}
              Security score
            </CardDescription>
            <CardTitle className={cn("text-4xl font-semibold tabular-nums", scoreTone)}>
              {report.score}
              <span className="text-lg text-muted-foreground">/100</span>
            </CardTitle>
            <Progress value={report.score} />
            <p className="text-xs text-muted-foreground">
              {report.total === 0 ? "Add logins to get a score." : `${report.total} login${report.total === 1 ? "" : "s"} analysed.`}
            </p>
          </CardHeader>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="shadow-xs">
              <CardHeader>
                <CardDescription className="flex items-center justify-between">
                  {label}
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", tone)}>
                    <Icon className="size-4" />
                  </span>
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="breached" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="breached">Breached ({breaches instanceof Map ? report.breached.length : "…"})</TabsTrigger>
          <TabsTrigger value="weak">Weak ({report.weak.length})</TabsTrigger>
          <TabsTrigger value="reused">Reused ({report.reusedCount})</TabsTrigger>
          <TabsTrigger value="old">Old ({report.old.length})</TabsTrigger>
          <TabsTrigger value="access">Access ({report.shared} shared)</TabsTrigger>
        </TabsList>

        <TabsContent value="breached">
          {breaches === null ? (
            <Card className="py-14 text-center text-sm text-muted-foreground shadow-xs">Checking your passwords against known data breaches…</Card>
          ) : breaches === "error" ? (
            <Card className="py-14 text-center text-sm text-muted-foreground shadow-xs">Couldn&apos;t reach the breach database. Check your connection and reload.</Card>
          ) : (
            <ReportCard empty={report.breached.length === 0} emptyText="None of your passwords appear in known data breaches.">
              <ItemTable
                rows={report.breached.map(({ item, count }) => ({
                  item,
                  detail: <Badge variant="destructive">Seen {formatBreachCount(count)}× in breaches</Badge>,
                  hint: "Attackers try these passwords first. Change it everywhere you use it.",
                }))}
                onFix={open}
              />
            </ReportCard>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Checked privately with Have I Been Pwned: only the first 5 characters of each password&apos;s SHA-1 hash are sent, never the password.
          </p>
        </TabsContent>

        <TabsContent value="weak">
          <ReportCard empty={report.weak.length === 0} emptyText="No weak passwords. Nice work.">
            <ItemTable
              rows={report.weak.map(({ item, strength }) => ({ item, detail: <Badge variant="destructive">{strength.label}</Badge>, hint: strength.hints[0] }))}
              onFix={open}
            />
          </ReportCard>
        </TabsContent>

        <TabsContent value="reused">
          <ReportCard empty={report.reused.length === 0} emptyText="Every password is unique.">
            <ItemTable
              rows={report.reused.flatMap((group, gi) =>
                group.map((item) => ({ item, detail: <Badge variant="outline" className="text-warning">Group {gi + 1} · used {group.length}×</Badge>, hint: `Same as ${group.filter((g) => g.id !== item.id).map((g) => g.name).join(", ")}` })),
              )}
              onFix={open}
            />
          </ReportCard>
        </TabsContent>

        <TabsContent value="old">
          <ReportCard empty={report.old.length === 0} emptyText={`All passwords were changed in the last ${OLD_DAYS} days.`}>
            <ItemTable
              rows={report.old.map(({ item, days }) => ({ item, detail: <Badge variant="outline">{days} days old</Badge>, hint: `Last changed ${formatDate(item.passwordUpdatedAt)}` }))}
              onFix={open}
            />
          </ReportCard>
        </TabsContent>

        <TabsContent value="access">
          <ReportCard empty={!overview || (overview.folders.length === 0 && overview.items.length === 0)} emptyText="You don't manage any shared folders or passwords yet.">
            {overview && (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Folder / password</TableHead>
                    <TableHead className="pr-4">People with access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...overview.folders.map((f) => ({ ...f, kind: "Folder" })), ...overview.items.map((i) => ({ ...i, kind: `Password · ${i.folderName}` }))].map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="py-3 pl-4 align-top">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.kind}</p>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          {row.people.map((p) => (
                            <Badge key={p.email} variant={p.pending ? "outline" : "secondary"} className="font-normal">
                              {p.name} · {PERMISSION_LABEL[p.permission]}
                              {p.pending && " · pending"}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ReportCard>
        </TabsContent>
      </Tabs>

      <ItemDialog mode={dialog} onClose={() => setDialog(null)} folders={folders} items={items} />
    </>
  );
}

function ReportCard({ empty, emptyText, children }: { empty: boolean; emptyText: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      {empty ? <EmptyState icon={<ShieldCheck />} title="All clear" description={emptyText} /> : children}
    </Card>
  );
}

function ItemTable({ rows, onFix }: { rows: { item: VaultItemRecord; detail: React.ReactNode; hint?: string }[]; onFix: (item: VaultItemRecord) => void }) {
  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Name</TableHead>
          <TableHead>Issue</TableHead>
          <TableHead className="hidden md:table-cell">Folder</TableHead>
          <TableHead className="w-24 pr-4 text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ item, detail, hint }) => (
          <TableRow key={`${item.id}-${hint}`}>
            <TableCell className="py-3 pl-4">
              <div className="flex items-center gap-3">
                <span className={cn("flex size-8 items-center justify-center rounded-lg text-xs font-semibold text-white uppercase", avatarColor(item.name))}>{item.name[0]}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{hostname(item.url) ?? "-"}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="grid gap-1">
                <span>{detail}</span>
                {hint && <span className="max-w-[40ch] truncate text-xs text-muted-foreground">{hint}</span>}
              </div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{item.folderName}</TableCell>
            <TableCell className="pr-4 text-right">
              <Button variant="outline" size="sm" onClick={() => onFix(item)} disabled={item.permission === "VIEW"}>
                {item.permission === "VIEW" ? "View only" : "Fix"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
