"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createVaultKeys,
  decryptJSON,
  generateDataKey,
  generateRecoveryKey,
  importPrivateKey,
  openKeyForUser,
  sealKeyForUser,
  sealPrivateKeyWithRecoveryKey,
  unlockPrivateKey,
  unwrapKey,
  type VaultKeyMaterial,
} from "@/lib/vault-crypto";
import { createVaultAccount, getPendingGrants, grantAccess, logVaultAccess } from "@/app/(app)/vault/actions";
import type { VaultFolderRecord, VaultItemRecord } from "@/lib/vault-data";

export type ItemSecret = { username: string; password: string; notes: string };

type VaultContextValue = {
  unlocked: boolean;
  publicKey: string | null;
  /** Creates the vault and returns the one-time recovery key to show the user. */
  setup: (masterPassword: string) => Promise<string>;
  unlock: (masterPassword: string, account: VaultKeyMaterial & { autoLockMinutes: number }) => Promise<void>;
  /** Unlock with raw private-key bytes (after recovering with a recovery key). */
  unlockWithKey: (pkcs8: Uint8Array<ArrayBuffer>, account: { publicKey: string; autoLockMinutes: number }) => Promise<void>;
  lock: () => void;
  folderKey: (folder: Pick<VaultFolderRecord, "id" | "encryptedFolderKey">) => Promise<CryptoKey>;
  itemKey: (item: VaultItemRecord, folders: VaultFolderRecord[]) => Promise<CryptoKey>;
  decryptItem: (item: VaultItemRecord, folders: VaultFolderRecord[]) => Promise<ItemSecret>;
  openSealed: (sealed: string) => Promise<CryptoKey>;
  grantPending: () => Promise<number>;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault() {
  const ctx = use(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;

/**
 * Holds the decrypted private key and data keys in memory only.
 * Nothing secret is ever written to storage; a reload or lock clears it all.
 */
export function VaultProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const cacheRef = useRef(new Map<string, Promise<CryptoKey>>());
  const [unlocked, setUnlocked] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);

  const lock = useCallback(() => {
    privateKeyRef.current = null;
    cacheRef.current.clear();
    setUnlocked(false);
  }, []);

  const requireKey = () => {
    if (!privateKeyRef.current) throw new Error("Vault is locked");
    return privateKeyRef.current;
  };

  const cached = (id: string, make: () => Promise<CryptoKey>) => {
    let p = cacheRef.current.get(id);
    if (!p) {
      p = make();
      p.catch(() => cacheRef.current.delete(id));
      cacheRef.current.set(id, p);
    }
    return p;
  };

  const openSealed = useCallback(async (sealed: string) => openKeyForUser(sealed, requireKey()), []);

  const folderKey = useCallback<VaultContextValue["folderKey"]>((folder) => {
    if (!folder.encryptedFolderKey) return Promise.reject(new Error("Awaiting access to this folder"));
    return cached(`f:${folder.id}:${folder.encryptedFolderKey.slice(-16)}`, () => openKeyForUser(folder.encryptedFolderKey!, requireKey()));
  }, []);

  const itemKey = useCallback<VaultContextValue["itemKey"]>(
    (item, folders) =>
      cached(`i:${item.id}:${(item.shareKey ?? item.encryptedItemKey).slice(-16)}`, async () => {
        if (item.via === "share") return openKeyForUser(item.shareKey!, requireKey());
        const folder = folders.find((f) => f.id === item.folderId);
        if (!folder) throw new Error("Folder not found");
        return unwrapKey(item.encryptedItemKey, await folderKey(folder));
      }),
    [folderKey],
  );

  const decryptItem = useCallback<VaultContextValue["decryptItem"]>(
    async (item, folders) => decryptJSON<ItemSecret>(await itemKey(item, folders), item.encryptedData),
    [itemKey],
  );

  /** Seal keys for teammates who were shared with before they had a vault. */
  const grantPending = useCallback(async () => {
    const res = await getPendingGrants();
    if (!res.ok) return 0;
    let granted = 0;
    for (const g of res.grants) {
      try {
        let key: CryptoKey;
        if (g.kind === "folder") key = await openKeyForUser(g.mySealedFolderKey, requireKey());
        else if (g.via === "folder") key = await unwrapKey(g.wrappedItemKey, await openKeyForUser(g.mySealedFolderKey, requireKey()));
        else key = await openKeyForUser(g.mySealedItemKey, requireKey());
        const result = await grantAccess(g.kind, g.id, await sealKeyForUser(key, g.publicKey));
        if (result.ok) granted++;
      } catch {
        // Skip entries we can't grant; another manager may handle them.
      }
    }
    return granted;
  }, []);

  const unlock = useCallback<VaultContextValue["unlock"]>(
    async (masterPassword, account) => {
      privateKeyRef.current = await unlockPrivateKey(masterPassword, account);
      cacheRef.current.clear();
      setPublicKey(account.publicKey);
      setAutoLockMinutes(account.autoLockMinutes);
      setUnlocked(true);
      void logVaultAccess("VAULT_UNLOCKED");
      void grantPending();
    },
    [grantPending],
  );

  const setup = useCallback<VaultContextValue["setup"]>(async (masterPassword) => {
    const { material, publicKey: pub, pkcs8 } = await createVaultKeys(masterPassword);
    const personalKey = await generateDataKey();
    const recoveryKey = generateRecoveryKey();
    const res = await createVaultAccount({
      ...material,
      personalFolderKey: await sealKeyForUser(personalKey, pub),
      recoveryWrappedPrivateKey: await sealPrivateKeyWithRecoveryKey(pkcs8, recoveryKey),
    });
    if (!res.ok) throw new Error(res.error);
    // Unseal through the normal path so the in-memory key is non-extractable.
    privateKeyRef.current = await unlockPrivateKey(masterPassword, material);
    cacheRef.current.clear();
    setPublicKey(material.publicKey);
    setUnlocked(true);
    void grantPending();
    return recoveryKey;
  }, [grantPending]);

  const unlockWithKey = useCallback<VaultContextValue["unlockWithKey"]>(
    async (pkcs8, account) => {
      privateKeyRef.current = await importPrivateKey(pkcs8);
      cacheRef.current.clear();
      setPublicKey(account.publicKey);
      setAutoLockMinutes(account.autoLockMinutes);
      setUnlocked(true);
      void grantPending();
    },
    [grantPending],
  );

  // Teammates may finish their vault setup while we're already unlocked, so keep
  // checking for people waiting on a key (periodically and when the tab regains focus).
  useEffect(() => {
    if (!unlocked) return;
    let running = false;
    const check = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        if ((await grantPending()) > 0) router.refresh();
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [unlocked, grantPending, router]);

  // Auto-lock after inactivity.
  useEffect(() => {
    if (!unlocked) return;
    let timer = window.setTimeout(lock, autoLockMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, autoLockMinutes * 60_000);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [unlocked, autoLockMinutes, lock]);

  const value = useMemo(
    () => ({ unlocked, publicKey, setup, unlock, unlockWithKey, lock, folderKey, itemKey, decryptItem, openSealed, grantPending }),
    [unlocked, publicKey, setup, unlock, unlockWithKey, lock, folderKey, itemKey, decryptItem, openSealed, grantPending],
  );

  return <VaultContext value={value}>{children}</VaultContext>;
}
