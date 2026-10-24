"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, LoaderCircle, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/icon-button";
import { UserAvatar } from "@/components/page";
import { useConfirm } from "@/components/confirm-dialog";
import { notify } from "@/components/toast";
import { useVault } from "@/components/vault/vault-provider";
import { PERMISSION_LABEL } from "@/components/vault/use-decrypted";
import { decryptJSON, encryptJSON, generateDataKey, sealKeyForUser, wrapKey } from "@/lib/vault-crypto";
import {
  findRecipient,
  getAccessList,
  getRotationTargets,
  revokeAccess,
  rotateFolderKey,
  shareFolder,
  shareItem,
  updateAccess,
  type AccessEntry,
} from "@/app/(app)/vault/actions";
import type { VaultFolderRecord, VaultItemRecord } from "@/lib/vault-data";

export type ShareTarget = { kind: "folder"; folder: VaultFolderRecord } | { kind: "item"; item: VaultItemRecord };

type Level = "MANAGE" | "MODIFY" | "VIEW";

const LEVELS: { value: Level; label: string; hint: string }[] = [
  { value: "VIEW", label: "View", hint: "See and copy" },
  { value: "MODIFY", label: "Modify", hint: "View and edit" },
  { value: "MANAGE", label: "Manage", hint: "Edit and share" },
];

export function ShareDialog({
  target,
  onClose,
  folders,
  items,
}: {
  target: ShareTarget | null;
  onClose: () => void;
  folders: VaultFolderRecord[];
  items: VaultItemRecord[];
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {target && <SharePanel key={target.kind === "folder" ? target.folder.id : target.item.id} target={target} folders={folders} items={items} />}
      </DialogContent>
    </Dialog>
  );
}

function SharePanel({ target, folders, items }: { target: ShareTarget; folders: VaultFolderRecord[]; items: VaultItemRecord[] }) {
  const vault = useVault();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<AccessEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<Level>("VIEW");
  const [busy, setBusy] = useState(false);

  const name = target.kind === "folder" ? target.folder.name : target.item.name;
  const permission = target.kind === "folder" ? target.folder.permission : target.item.permission;
  const canManage = permission === "OWNER" || permission === "MANAGE";
  const targetId = target.kind === "folder" ? target.folder.id : target.item.id;
  const targetKind = target.kind;

  const fetchEntries = useCallback(
    () => getAccessList(targetKind === "folder" ? { folderId: targetId } : { itemId: targetId }),
    [targetKind, targetId],
  );
  const apply = (res: Awaited<ReturnType<typeof fetchEntries>>) => {
    if (res.ok) setEntries(res.entries);
    else notify.error(res.error);
  };
  const load = async () => apply(await fetchEntries());

  useEffect(() => {
    let cancelled = false;
    // Grant keys to anyone who set up their vault since being invited, then list access.
    vault.grantPending().catch(() => 0).then(fetchEntries).then((res) => {
      if (cancelled) return;
      if (res.ok) setEntries(res.entries);
      else notify.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchEntries, vault]);

  const share = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const found = await findRecipient(email);
      if (!found.ok) throw new Error(found.error);
      let sealedKey: string | null = null;
      if (found.recipient.status === "ready") {
        const key = target.kind === "folder" ? await vault.folderKey(target.folder) : await vault.itemKey(target.item, folders);
        sealedKey = await sealKeyForUser(key, found.recipient.publicKey);
      }
      const res =
        target.kind === "folder"
          ? await shareFolder(target.folder.id, { email, permission: level, sealedKey })
          : await shareItem(target.item.id, { email, permission: level, sealedKey });
      if (!res.ok) throw new Error(res.error);
      if (res.pending) {
        notify.info(`Invited ${email}`, {
          description: found.recipient.status === "not-registered"
            ? "They'll get access after they sign up and set up their vault."
            : "They'll get access once they set up their vault.",
        });
      } else {
        notify.success(`Shared with ${found.recipient.status === "ready" ? found.recipient.name : email}`);
      }
      setEmail("");
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Couldn't share");
    } finally {
      setBusy(false);
    }
  };

  const change = async (entry: AccessEntry, next: Level) => {
    const res = await updateAccess(entry.kind, entry.id, next);
    if (!res.ok) return notify.error(res.error);
    notify.success(`${entry.name} now has ${PERMISSION_LABEL[next]} access`);
    await load();
  };

  /** New folder key + new item keys, re-sealed for everyone who still has access. */
  const rotateFolder = async (folder: VaultFolderRecord) => {
    const targets = await getRotationTargets(folder.id);
    if (!targets.ok) throw new Error(targets.error);
    const newFolderKey = await generateDataKey();
    const members = await Promise.all(targets.members.map(async (m) => ({ memberId: m.memberId, sealedKey: await sealKeyForUser(newFolderKey, m.publicKey) })));
    const rotated = await Promise.all(
      targets.items.map(async (t) => {
        const item = items.find((i) => i.id === t.itemId && i.via === "folder");
        if (!item) throw new Error("Some passwords changed while rotating. Refresh and try again.");
        const data = await decryptJSON(await vault.itemKey(item, folders), item.encryptedData);
        const newItemKey = await generateDataKey();
        return {
          itemId: t.itemId,
          encryptedItemKey: await wrapKey(newItemKey, newFolderKey),
          encryptedData: await encryptJSON(newItemKey, data),
          shares: await Promise.all(t.shares.map(async (s) => ({ shareId: s.shareId, sealedKey: await sealKeyForUser(newItemKey, s.publicKey) }))),
        };
      }),
    );
    const res = await rotateFolderKey(folder.id, { members, items: rotated });
    if (!res.ok) throw new Error(res.error);
  };

  const revoke = async (entry: AccessEntry) => {
    const ok = await confirm({
      title: `Remove ${entry.name}?`,
      description: `They'll lose access to "${name}".`,
      confirmText: "Remove access",
      tone: "danger",
    });
    if (!ok) return;
    const res = await revokeAccess(entry.kind, entry.id);
    if (!res.ok) return notify.error(res.error);
    notify.success(`Removed ${entry.name}`);
    await load();

    // Someone who had the key could have kept a copy; re-encrypting closes that gap.
    if (target.kind === "folder" && entry.kind === "folderMember" && !entry.pending) {
      const rotate = await confirm({
        title: "Rotate the folder's encryption key?",
        description: "Recommended. Every password in this folder is re-encrypted with a new key, so a copy kept by the removed person becomes useless.",
        confirmText: "Rotate key",
        cancelText: "Not now",
      });
      if (!rotate) return;
      try {
        await rotateFolder(target.folder);
        notify.success("Encryption key rotated");
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't rotate the key");
      }
    } else if (target.kind === "item" && !entry.pending) {
      notify.info("Tip: change this password", { description: "They may have seen it while they had access." });
    }
  };

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Share &ldquo;{name}&rdquo;</DialogTitle>
        <DialogDescription>
          {target.kind === "folder"
            ? "Everyone you add can access every password in this folder."
            : "Only this password is shared. The rest of its folder stays private."}
        </DialogDescription>
      </DialogHeader>

      {canManage && (
        <form onSubmit={share} className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" className="flex-1" autoFocus />
          <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
            <SelectTrigger className="sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label} <span className="text-muted-foreground">· {l.hint}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={busy || !email}>
            {busy ? <LoaderCircle className="animate-spin" /> : <UserPlus />} Share
          </Button>
        </form>
      )}

      <div className="grid gap-1">
        <p className="text-sm font-medium">People with access</p>
        {!entries ? (
          <div className="grid gap-2 py-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Not shared with anyone yet.</p>
        ) : (
          <ul className="-mx-2 max-h-72 overflow-y-auto">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                <UserAvatar name={e.name} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {e.name} {e.isYou && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {e.kind === "invite" ? "Invited · not signed up yet" : e.email}
                    {e.pending && e.kind !== "invite" && (
                      <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px] text-warning">
                        <Clock className="size-2.5" /> Awaiting access
                      </Badge>
                    )}
                  </p>
                </div>
                {canManage && !e.isOwner && !e.isYou ? (
                  <>
                    <Select value={e.permission} onValueChange={(v) => change(e, v as Level)}>
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <IconButton label="Remove access" variant="destructive-ghost" size="icon-sm" onClick={() => revoke(e)}>
                      <Trash2 />
                    </IconButton>
                  </>
                ) : (
                  <Badge variant={e.isOwner ? "default" : "secondary"}>{PERMISSION_LABEL[e.permission]}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
