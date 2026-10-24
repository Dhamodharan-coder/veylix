"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderPlus, LoaderCircle, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/confirm-dialog";
import { notify } from "@/components/toast";
import { useVault } from "@/components/vault/vault-provider";
import { ShareDialog } from "@/components/vault/share-dialog";
import { generateDataKey, sealKeyForUser } from "@/lib/vault-crypto";
import { createFolder, deleteFolder, renameFolder } from "@/app/(app)/vault/actions";
import type { VaultFolderRecord, VaultItemRecord } from "@/lib/vault-data";

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && <NameForm initial={initial} submitLabel={submitLabel} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({ initial, submitLabel, onSubmit }: { initial: string; submitLabel: string; onSubmit: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSubmit(name);
        setPending(false);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="folder-name">Folder name</Label>
        <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus placeholder="e.g. Engineering" />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={pending || !name.trim()}>
          {pending && <LoaderCircle className="animate-spin" />} {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewFolderButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const { publicKey } = useVault();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <FolderPlus /> New folder
      </Button>
      <NameDialog
        open={open}
        onOpenChange={setOpen}
        title="Create folder"
        description="Group related passwords and share the whole folder with your team."
        initial=""
        submitLabel="Create folder"
        onSubmit={async (name) => {
          if (!publicKey) return false;
          const key = await generateDataKey();
          const res = await createFolder({ name, encryptedFolderKey: await sealKeyForUser(key, publicKey) });
          if (!res.ok) {
            notify.error(res.error);
            return false;
          }
          notify.success(`Folder "${name}" created`);
          setOpen(false);
          router.push(`/vault/folders/${res.folderId}`);
          return true;
        }}
      />
    </>
  );
}

/** Share / rename / delete menu for a folder. */
export function FolderMenu({
  folder,
  folders,
  items,
  trigger = "icon",
  afterDelete,
}: {
  folder: VaultFolderRecord;
  folders: VaultFolderRecord[];
  items: VaultItemRecord[];
  trigger?: "icon" | "buttons";
  afterDelete?: () => void;
}) {
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const canManage = folder.permission === "OWNER" || folder.permission === "MANAGE";
  const canDelete = folder.permission === "OWNER" && !folder.isPersonal;
  const canShare = canManage && !folder.isPersonal && !!folder.encryptedFolderKey;

  const remove = async () => {
    const ok = await confirm({
      title: `Delete "${folder.name}"?`,
      description: `All ${folder.itemCount} password${folder.itemCount === 1 ? "" : "s"} inside will be permanently deleted for everyone with access.`,
      confirmText: "Delete folder",
      tone: "danger",
      requireText: folder.name,
    });
    if (!ok) return;
    const res = await deleteFolder(folder.id);
    if (!res.ok) return notify.error(res.error);
    notify.success(`Folder "${folder.name}" deleted`);
    afterDelete?.();
  };

  if (!canManage && !canShare && !canDelete) return null;

  const dialogs = (
    <>
      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename folder"
        description="Everyone with access will see the new name."
        initial={folder.name}
        submitLabel="Save"
        onSubmit={async (name) => {
          const res = await renameFolder(folder.id, name);
          if (!res.ok) {
            notify.error(res.error);
            return false;
          }
          notify.success("Folder renamed");
          setRenaming(false);
          return true;
        }}
      />
      <ShareDialog target={sharing ? { kind: "folder", folder } : null} onClose={() => setSharing(false)} folders={folders} items={items} />
    </>
  );

  if (trigger === "buttons") {
    return (
      <>
        {canShare && (
          <Button variant="outline" onClick={() => setSharing(true)}>
            <Share2 /> Share folder
          </Button>
        )}
        {canManage && !folder.isPersonal && (
          <Button variant="outline" onClick={() => setRenaming(true)}>
            <Pencil /> Rename
          </Button>
        )}
        {canDelete && (
          <Button variant="destructive" onClick={remove}>
            <Trash2 /> Delete
          </Button>
        )}
        {dialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Folder actions" className="relative z-10">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canShare && (
            <DropdownMenuItem onClick={() => setSharing(true)}>
              <Share2 /> Share
            </DropdownMenuItem>
          )}
          {canManage && !folder.isPersonal && (
            <DropdownMenuItem onClick={() => setRenaming(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={remove}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
