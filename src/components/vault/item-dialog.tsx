"use client";

import { useState } from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordGenerator } from "@/components/vault/password-generator";
import { StrengthMeter } from "@/components/vault/strength-meter";
import { useVault, type ItemSecret } from "@/components/vault/vault-provider";
import { notify } from "@/components/toast";
import { encryptJSON, generateDataKey, wrapKey } from "@/lib/vault-crypto";
import { createItem, moveItem, updateItem } from "@/app/(app)/vault/actions";
import type { VaultFolderRecord, VaultItemRecord } from "@/lib/vault-data";
import { PERMISSION_LABEL } from "@/components/vault/use-decrypted";

export type ItemDialogMode =
  | { kind: "create"; folderId?: string }
  | { kind: "edit"; item: VaultItemRecord; secret: ItemSecret };

type Props = {
  mode: ItemDialogMode | null;
  onClose: () => void;
  folders: VaultFolderRecord[];
  items: VaultItemRecord[];
};

export function ItemDialog({ mode, onClose, folders, items }: Props) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {mode && <ItemForm key={mode.kind === "edit" ? mode.item.id : "new"} mode={mode} onClose={onClose} folders={folders} items={items} />}
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({ mode, onClose, folders }: Props & { mode: ItemDialogMode }) {
  const { folderKey, itemKey } = useVault();
  const editing = mode.kind === "edit" ? mode.item : null;
  const readOnly = editing ? editing.permission === "VIEW" : false;
  const writableFolders = folders.filter((f) => f.encryptedFolderKey && ["OWNER", "MANAGE", "MODIFY"].includes(f.permission));
  const defaultFolder =
    editing?.folderId ??
    (mode.kind === "create" ? mode.folderId : undefined) ??
    writableFolders.find((f) => f.isPersonal && f.isOwner)?.id ??
    writableFolders[0]?.id ??
    "";

  const [type, setType] = useState(editing?.type ?? "LOGIN");
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [username, setUsername] = useState(mode.kind === "edit" ? mode.secret.username : "");
  const [password, setPassword] = useState(mode.kind === "edit" ? mode.secret.password : "");
  const [notes, setNotes] = useState(mode.kind === "edit" ? mode.secret.notes : "");
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [folderId, setFolderId] = useState(defaultFolder);
  const [showPassword, setShowPassword] = useState(mode.kind === "create");
  const [showGenerator, setShowGenerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Moving needs folder-level access to the current folder (not just a direct share).
  const canMove = editing ? editing.via === "folder" && editing.canDelete : true;

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/,/g, "");
    if (t && !tags.includes(t)) setTags([...tags, t].slice(0, 20));
    setTagInput("");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) return;
    setPending(true);
    setError(null);
    try {
      const secret: ItemSecret = { username, password: type === "LOGIN" ? password : "", notes };
      const fields = { name, url: type === "LOGIN" ? url : null, tags };

      if (!editing) {
        const folder = writableFolders.find((f) => f.id === folderId);
        if (!folder) throw new Error("Choose a folder");
        const key = await generateDataKey();
        const res = await createItem({
          folderId,
          type,
          ...fields,
          encryptedItemKey: await wrapKey(key, await folderKey(folder)),
          encryptedData: await encryptJSON(key, secret),
        });
        if (!res.ok) throw new Error(res.error);
        notify.success(`${name} saved to ${folder.name}`);
      } else {
        const key = await itemKey(editing, folders);
        const res = await updateItem(editing.id, {
          ...fields,
          encryptedData: await encryptJSON(key, secret),
          passwordChanged: mode.kind === "edit" && mode.secret.password !== secret.password,
        });
        if (!res.ok) throw new Error(res.error);
        if (folderId !== editing.folderId) {
          const target = writableFolders.find((f) => f.id === folderId);
          if (!target) throw new Error("Choose a folder");
          const moved = await moveItem(editing.id, folderId, await wrapKey(key, await folderKey(target)));
          if (!moved.ok) throw new Error(moved.error);
        }
        notify.success(`${name} updated`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this item");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{!editing ? "Add password" : readOnly ? editing.name : `Edit ${editing.name}`}</DialogTitle>
        <DialogDescription>
          {readOnly ? (
            <>You have <Badge variant="secondary">{PERMISSION_LABEL[editing!.permission]}</Badge> access to this item.</>
          ) : (
            "Encrypted in your browser before it's saved. Only people with access can read it."
          )}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!editing && (
        <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
          <TabsList className="w-full">
            <TabsTrigger value="LOGIN">Login</TabsTrigger>
            <TabsTrigger value="SECURE_NOTE">Secure note</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <fieldset disabled={readOnly || pending} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus={!editing} placeholder="e.g. AWS Console" />
          </div>
          <div className="grid gap-2">
            <Label>Folder</Label>
            <Select value={folderId} onValueChange={setFolderId} disabled={readOnly || !canMove}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a folder" />
              </SelectTrigger>
              <SelectContent>
                {(canMove ? writableFolders : folders.filter((f) => f.id === folderId)).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
                {editing && !writableFolders.some((f) => f.id === folderId) && (
                  <SelectItem value={folderId}>{editing.folderName}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {type === "LOGIN" && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="item-url">Website</Label>
              <Input id="item-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://console.aws.amazon.com" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="item-username">Username / email</Label>
                <Input id="item-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="font-mono" />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="item-password">Password</Label>
                  {!readOnly && (
                    <button type="button" onClick={() => setShowGenerator(!showGenerator)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Wand2 className="size-3" /> {showGenerator ? "Hide generator" : "Generate"}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="item-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-9 font-mono"
                  />
                  <Button type="button" variant="ghost" size="icon-xs" className="absolute top-1/2 right-1.5 -translate-y-1/2" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} disabled={false}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {password && <StrengthMeter password={password} />}
              </div>
            </div>
            {showGenerator && !readOnly && (
              <div className="rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/10">
                <PasswordGenerator
                  onUse={(v) => {
                    setPassword(v);
                    setShowPassword(true);
                    setShowGenerator(false);
                  }}
                />
              </div>
            )}
          </>
        )}

        <div className="grid gap-2">
          <Label htmlFor="item-notes">{type === "LOGIN" ? "Notes" : "Secure note"}</Label>
          <Textarea id="item-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={type === "LOGIN" ? 3 : 8} placeholder={type === "LOGIN" ? "Recovery codes, security questions…" : "Anything you want to keep secret"} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="item-tags">Tags</Label>
          <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 dark:bg-input/30">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                {!readOnly && (
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
            <input
              id="item-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                } else if (e.key === "Backspace" && !tagInput) setTags(tags.slice(0, -1));
              }}
              onBlur={addTag}
              placeholder={tags.length ? "" : "work, aws, production…"}
              className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </fieldset>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button disabled={pending || !name.trim() || !folderId}>
            {pending ? <><LoaderCircle className="animate-spin" /> Saving…</> : editing ? "Save changes" : "Save password"}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
