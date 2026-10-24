"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader, formatDate, type Crumb } from "@/components/page";
import { IconButton } from "@/components/icon-button";
import { useConfirm } from "@/components/confirm-dialog";
import { notify } from "@/components/toast";
import { ItemDialog, type ItemDialogMode } from "@/components/vault/item-dialog";
import { ShareDialog, type ShareTarget } from "@/components/vault/share-dialog";
import { PERMISSION_LABEL, avatarColor, hostname, useDecrypted } from "@/components/vault/use-decrypted";
import { deleteItem, logVaultAccess, toggleFavorite } from "@/app/(app)/vault/actions";
import type { VaultSnapshot, VaultItemRecord } from "@/lib/vault-data";
import type { ItemSecret } from "@/components/vault/vault-provider";
import { cn } from "@/lib/utils";

export type PasswordsFilter = { kind: "all" } | { kind: "favorites" } | { kind: "shared" } | { kind: "folder"; folderId: string };

export function PasswordsView({
  snapshot,
  filter,
  title,
  description,
  breadcrumbs,
  headerActions,
}: {
  snapshot: VaultSnapshot;
  filter: PasswordsFilter;
  title: string;
  description: string;
  breadcrumbs?: Crumb[];
  headerActions?: React.ReactNode;
}) {
  const { folders, items: allItems, awaiting } = snapshot;
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [dialog, setDialog] = useState<ItemDialogMode | null>(null);
  const [share, setShare] = useState<ShareTarget | null>(null);

  const scoped = useMemo(() => {
    const folderById = new Map(folders.map((f) => [f.id, f]));
    return allItems.filter((i) => {
      if (filter.kind === "favorites") return i.favorite;
      if (filter.kind === "shared") return i.via === "share" || !folderById.get(i.folderId)?.isOwner;
      if (filter.kind === "folder") return i.folderId === filter.folderId;
      return true;
    });
  }, [allItems, folders, filter]);

  const { secrets, ready } = useDecrypted(scoped, folders);

  const q = query.trim().toLowerCase();
  const visible = scoped.filter((i) => {
    if (folderFilter !== "all" && i.folderId !== folderFilter) return false;
    if (!q) return true;
    const s = secrets.get(i.id);
    const username = s && s !== "error" ? s.username.toLowerCase() : "";
    return i.name.toLowerCase().includes(q) || (i.url ?? "").toLowerCase().includes(q) || username.includes(q) || i.tags.some((t) => t.includes(q));
  });

  const canAdd = folders.some((f) => f.encryptedFolderKey && ["OWNER", "MANAGE", "MODIFY"].includes(f.permission));
  const addButton = canAdd && (
    <Button onClick={() => setDialog({ kind: "create", folderId: filter.kind === "folder" ? filter.folderId : undefined })}>
      <Plus /> Add password
    </Button>
  );

  return (
    <>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={<>{headerActions}{addButton}</>} />

      {filter.kind === "shared" && awaiting.length > 0 && (
        <Card className="mb-4 flex-row items-center gap-3 px-4 py-3 shadow-xs">
          <Clock className="size-4 shrink-0 text-warning" />
          <p className="text-sm">
            <span className="font-medium">{awaiting.length} shared password{awaiting.length === 1 ? "" : "s"} awaiting access.</span>{" "}
            <span className="text-muted-foreground">You&apos;ll be able to open them once the person who shared them opens their vault.</span>
          </p>
        </Card>
      )}

      <Card className="gap-0 py-0 shadow-xs">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, website, username or tag…" aria-label="Search passwords" className="pl-8" />
          </div>
          <div className="flex items-center gap-2">
            {filter.kind !== "folder" && folders.length > 1 && (
              <Select value={folderFilter} onValueChange={setFolderFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All folders</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {visible.length} item{visible.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {scoped.length === 0 ? (
          <EmptyState
            icon={filter.kind === "favorites" ? <Star /> : filter.kind === "shared" ? <Users /> : <KeyRound />}
            title={filter.kind === "favorites" ? "No favorites yet" : filter.kind === "shared" ? "Nothing shared with you yet" : "No passwords yet"}
            description={
              filter.kind === "favorites"
                ? "Star the passwords you use most to find them here."
                : filter.kind === "shared"
                  ? "Passwords and folders your teammates share with you will appear here."
                  : "Save your first login. It's encrypted in your browser before it's stored."
            }
            action={filter.kind === "all" || filter.kind === "folder" ? addButton : undefined}
          />
        ) : visible.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-muted-foreground">No passwords match your search.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="hidden md:table-cell">Username</TableHead>
                <TableHead className="hidden lg:table-cell">Folder</TableHead>
                <TableHead className="hidden xl:table-cell">Updated</TableHead>
                <TableHead className="w-48 pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  secret={secrets.get(item.id)}
                  loading={!ready}
                  onOpen={(secret) => setDialog({ kind: "edit", item, secret })}
                  onShare={() => setShare({ kind: "item", item })}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ItemDialog mode={dialog} onClose={() => setDialog(null)} folders={folders} items={allItems} />
      <ShareDialog target={share} onClose={() => setShare(null)} folders={folders} items={allItems} />
    </>
  );
}

function ItemRow({
  item,
  secret,
  loading,
  onOpen,
  onShare,
}: {
  item: VaultItemRecord;
  secret: ItemSecret | "error" | undefined;
  loading: boolean;
  onOpen: (secret: ItemSecret) => void;
  onShare: () => void;
}) {
  const confirm = useConfirm();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"user" | "pass" | null>(null);
  const ok = secret && secret !== "error" ? secret : null;
  const site = hostname(item.url);
  const canManage = item.permission === "OWNER" || item.permission === "MANAGE";

  const copy = async (what: "user" | "pass") => {
    if (!ok) return;
    await navigator.clipboard.writeText(what === "user" ? ok.username : ok.password);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
    notify.success(`${what === "user" ? "Username" : "Password"} copied`, { description: what === "pass" ? "Clear your clipboard when you're done." : undefined });
    void logVaultAccess(what === "user" ? "USERNAME_COPIED" : "PASSWORD_COPIED", item.id);
  };

  const remove = async () => {
    const yes = await confirm({
      title: `Delete ${item.name}?`,
      description: item.shared ? "It's shared, so it will be removed for everyone with access. This can't be undone." : "This can't be undone.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!yes) return;
    const res = await deleteItem(item.id);
    if (!res.ok) return notify.error(res.error);
    notify.success(`${item.name} deleted`);
  };

  const favorite = async () => {
    const res = await toggleFavorite(item.id);
    if (!res.ok) notify.error(res.error);
  };

  return (
    <TableRow className="group">
      <TableCell className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white uppercase", avatarColor(item.name))}>
            {item.type === "SECURE_NOTE" ? <FileText className="size-4" /> : item.name[0]}
          </span>
          <div className="min-w-0">
            <button type="button" onClick={() => ok && onOpen(ok)} className="flex items-center gap-1.5 truncate font-medium hover:underline" disabled={!ok}>
              {item.name}
              {item.favorite && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
            </button>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {site ? <span className="truncate">{site}</span> : item.type === "SECURE_NOTE" && <span>Secure note</span>}
              {item.shared && (
                <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
                  <Users className="size-2.5" /> {item.via === "share" ? `Shared by ${item.sharedByName ?? "teammate"}` : "Shared"}
                </Badge>
              )}
              {item.permission !== "OWNER" && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                  {PERMISSION_LABEL[item.permission]}
                </Badge>
              )}
              {item.tags.map((t) => (
                <Badge key={t} variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {loading ? (
          <Skeleton className="h-4 w-32" />
        ) : secret === "error" ? (
          <span className="text-xs text-destructive">Can&apos;t decrypt</span>
        ) : (
          <div className="grid font-mono text-[13px]">
            <span className="truncate">{ok?.username || <span className="text-muted-foreground">-</span>}</span>
            {item.type === "LOGIN" && (
              <span className="truncate text-muted-foreground">{revealed ? ok?.password : "••••••••••"}</span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">{item.folderName}</TableCell>
      <TableCell className="hidden text-muted-foreground xl:table-cell">{formatDate(item.updatedAt)}</TableCell>
      <TableCell className="pr-4">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label={item.favorite ? "Remove from favorites" : "Add to favorites"} onClick={favorite}>
            <Star className={cn(item.favorite && "fill-amber-400 text-amber-400")} />
          </IconButton>
          {item.type === "LOGIN" && (
            <>
              <IconButton label="Copy username" disabled={!ok?.username} onClick={() => copy("user")}>
                {copied === "user" ? <Check className="text-success" /> : <User />}
              </IconButton>
              <IconButton label="Copy password" disabled={!ok?.password} onClick={() => copy("pass")}>
                {copied === "pass" ? <Check className="text-success" /> : <Copy />}
              </IconButton>
            </>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {item.type === "LOGIN" && (
                <DropdownMenuItem
                  disabled={!ok?.password}
                  onClick={() => {
                    setRevealed(!revealed);
                    if (!revealed) void logVaultAccess("PASSWORD_REVEALED", item.id);
                  }}
                >
                  {revealed ? <EyeOff /> : <Eye />} {revealed ? "Hide password" : "Show password"}
                </DropdownMenuItem>
              )}
              {item.url && (
                <DropdownMenuItem
                  onClick={() => {
                    window.open(item.url!, "_blank", "noopener,noreferrer");
                    void logVaultAccess("URL_OPENED", item.id);
                  }}
                >
                  <ExternalLink /> Open website
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={!ok} onClick={() => ok && onOpen(ok)}>
                <Pencil /> {item.permission === "VIEW" ? "View details" : "Edit"}
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem onClick={onShare}>
                  <Share2 /> Share
                </DropdownMenuItem>
              )}
              {item.canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={remove}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
