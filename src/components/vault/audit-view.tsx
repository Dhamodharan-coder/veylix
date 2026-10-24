"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RotateCcw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, UserAvatar } from "@/components/page";
import { TableRowsSkeleton } from "@/components/skeletons";
import { notify } from "@/components/toast";
import { listAuditFilterOptions, listAuditLogs, type AuditRow } from "@/app/(app)/vault/actions";

type Filters = { action: string; folderId: string; actorId: string; from: string; to: string };
const EMPTY: Filters = { action: "all", folderId: "all", actorId: "all", from: "", to: "" };
type Options = { folders: { id: string; name: string }[]; people: { id: string; name: string }[]; actions: { value: string; label: string }[] };

const TONE: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  ITEM_DELETED: "destructive",
  FOLDER_DELETED: "destructive",
  ACCESS_REVOKED: "destructive",
  PASSWORD_REVEALED: "outline",
  PASSWORD_COPIED: "outline",
  USERNAME_COPIED: "outline",
  URL_OPENED: "outline",
  FOLDER_SHARED: "default",
  ITEM_SHARED: "default",
  KEY_GRANTED: "default",
};

function describe(row: AuditRow) {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  if (m.with) return `with ${m.with} (${String(m.permission ?? "").toLowerCase()})`;
  if (m.who && m.permission) return `${m.who} → ${String(m.permission).toLowerCase()}`;
  if (m.who) return String(m.who);
  if (m.from && m.to) return `${m.from} → ${m.to}`;
  if (m.from) return `renamed from ${m.from}`;
  if (m.passwordChanged) return "password changed";
  return null;
}

function device(ua: string | null) {
  if (!ua) return "-";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function AuditView() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [options, setOptions] = useState<Options | null>(null);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (f: Filters, after?: string) =>
      listAuditLogs({
        action: f.action === "all" ? undefined : f.action,
        folderId: f.folderId === "all" ? undefined : f.folderId,
        actorId: f.actorId === "all" ? undefined : f.actorId,
        from: f.from || undefined,
        to: f.to || undefined,
        cursor: after,
      }),
    [],
  );

  useEffect(() => {
    listAuditFilterOptions().then((res) => res.ok && setOptions(res));
  }, []);

  useEffect(() => {
    let cancelled = false;
    query(filters).then((res) => {
      if (cancelled) return;
      if (!res.ok) return notify.error(res.error);
      setRows(res.logs);
      setCursor(res.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [filters, query]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await query(filters, cursor);
    setLoadingMore(false);
    if (!res.ok) return notify.error(res.error);
    setRows((r) => [...(r ?? []), ...res.logs]);
    setCursor(res.nextCursor);
  };

  const set = (patch: Partial<Filters>) => {
    setRows(null);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  return (
    <>
      <PageHeader title="Audit" description="Who accessed or changed what in the vault, and when. You see your own activity and everything in folders you manage." />
      <Card className="gap-0 py-0 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Select value={filters.action} onValueChange={(v) => set({ action: v })}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {options?.actions.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.actorId} onValueChange={(v) => set({ actorId: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All people" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All people</SelectItem>
              {options?.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.folderId} onValueChange={(v) => set({ folderId: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {options?.folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="w-40" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="w-40" />
          {filtered && (
            <Button variant="ghost" onClick={() => set(EMPTY)}>
              <RotateCcw /> Reset
            </Button>
          )}
        </div>

        {!rows ? (
          <TableRowsSkeleton rows={8} cols={["w-24", "w-40", "w-32", "w-1/4", "w-28"]} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No activity found" description={filtered ? "Try different filters." : "Vault activity will be recorded here."} />
        ) : (
          <>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="hidden pr-4 lg:table-cell">IP · Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const detail = describe(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="py-3 pl-4 whitespace-nowrap text-muted-foreground">{formatTime(r.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={r.actorName} className="size-7" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.actorName}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.actorEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TONE[r.action] ?? "secondary"}>{r.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[28ch] truncate font-medium">{r.targetName ?? "-"}</p>
                        <p className="max-w-[36ch] truncate text-xs text-muted-foreground">
                          {[r.folderName && r.folderName !== r.targetName ? r.folderName : null, detail].filter(Boolean).join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell className="hidden pr-4 text-xs text-muted-foreground lg:table-cell">
                        <p className="font-mono">{r.ipAddress ?? "-"}</p>
                        <p>{device(r.userAgent)}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {cursor && (
              <div className="flex justify-center border-t p-3">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <LoaderCircle className="animate-spin" />} Load more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
