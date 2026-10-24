"use client";

import { useEffect, useState } from "react";
import { useVault, type ItemSecret } from "@/components/vault/vault-provider";
import type { VaultFolderRecord, VaultItemRecord } from "@/lib/vault-data";

export type DecryptedMap = Map<string, ItemSecret | "error">;

/** Decrypts items in the browser; values only ever live in memory. */
export function useDecrypted(items: VaultItemRecord[], folders: VaultFolderRecord[]) {
  const { decryptItem, unlocked } = useVault();
  const [secrets, setSecrets] = useState<DecryptedMap>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    Promise.all(
      items.map(async (item) => [item.id, await decryptItem(item, folders).catch(() => "error" as const)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setSecrets(new Map(entries));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [items, folders, decryptItem, unlocked]);

  return { secrets, ready };
}

/** Deterministic avatar color from a name. */
const AVATAR_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600"];
export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function hostname(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const PERMISSION_LABEL = { OWNER: "Owner", MANAGE: "Manage", MODIFY: "Modify", VIEW: "View" } as const;
