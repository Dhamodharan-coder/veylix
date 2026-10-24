"use client";

import Link from "next/link";
import { Clock, Folder, FolderLock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page";
import { FolderMenu, NewFolderButton } from "@/components/vault/folder-actions";
import { PERMISSION_LABEL } from "@/components/vault/use-decrypted";
import type { VaultSnapshot } from "@/lib/vault-data";
import { cn } from "@/lib/utils";

export function FoldersView({ snapshot }: { snapshot: VaultSnapshot }) {
  const { folders, items } = snapshot;
  return (
    <>
      <PageHeader title="Folders" description="Organize passwords into folders and share whole folders with your team." actions={<NewFolderButton />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((f) => {
          const awaiting = !f.encryptedFolderKey;
          const Icon = f.isPersonal ? FolderLock : f.memberCount > 1 ? Users : Folder;
          return (
            <Card key={f.id} className={cn("relative gap-4 p-5 shadow-xs transition hover:ring-foreground/20", awaiting && "opacity-80")}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex size-10 items-center justify-center rounded-lg", f.isPersonal ? "bg-primary/10 text-primary" : "bg-emerald-600/10 text-emerald-600")}>
                  <Icon className="size-5" />
                </span>
                <FolderMenu folder={f} folders={folders} items={items} />
              </div>
              <div>
                {awaiting ? (
                  <p className="font-semibold">{f.name}</p>
                ) : (
                  <Link href={`/vault/folders/${f.id}`} className="font-semibold after:absolute after:inset-0">
                    {f.name}
                  </Link>
                )}
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {f.isPersonal ? "Only you" : f.isOwner ? `${f.memberCount} member${f.memberCount === 1 ? "" : "s"}` : `Shared by ${f.ownerName}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  {f.itemCount} password{f.itemCount === 1 ? "" : "s"}
                </Badge>
                {!f.isOwner && <Badge variant="outline">{PERMISSION_LABEL[f.permission]}</Badge>}
                {awaiting && (
                  <Badge variant="outline" className="gap-1 text-warning">
                    <Clock className="size-3" /> Awaiting access
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {folders.length === 0 && (
        <Card className="shadow-xs">
          <EmptyState icon={<Folder />} title="No folders" description="Create a folder to start organizing passwords." action={<NewFolderButton />} />
        </Card>
      )}
    </>
  );
}
