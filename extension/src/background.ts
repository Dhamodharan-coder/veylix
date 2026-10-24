// Veylix extension service worker: talks to the Veylix API, unlocks the vault
// with the master password (zero-knowledge, all crypto happens here) and fills
// login forms in tabs.

import {
  decryptJSON,
  decryptString,
  encryptString,
  fromB64,
  importPrivateKey,
  openKeyForUser,
  toB64,
  unlockPrivateKeyBytes,
  unwrapKey,
} from "../../src/lib/vault-crypto";
import { DEFAULT_BASE_URL, matchScore, type BiometricInfo, type Login, type LoginSummary, type Request, type Response, type Status } from "./shared";

// ---------- API types (subset of src/lib/vault-data.ts) ----------

type Account = { kdfSalt: string; kdfIterations: number; publicKey: string; encryptedPrivateKey: string; autoLockMinutes: number };
type FolderRecord = { id: string; encryptedFolderKey: string | null };
type ItemRecord = {
  id: string;
  folderId: string;
  folderName: string;
  type: "LOGIN" | "SECURE_NOTE";
  name: string;
  url: string | null;
  encryptedData: string;
  encryptedItemKey: string;
  shareKey: string | null;
  via: "folder" | "share";
  favorite: boolean;
};
type VaultPayload = {
  user: { name: string; email: string };
  account: Account | null;
  snapshot: { folders: FolderRecord[]; items: ItemRecord[] } | null;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- settings & auth ----------

async function baseUrl(): Promise<string> {
  const { baseUrl } = await chrome.storage.local.get("baseUrl");
  return typeof baseUrl === "string" && baseUrl ? baseUrl : DEFAULT_BASE_URL;
}

/** The signed Better Auth session token, read from the Veylix cookie. */
async function sessionToken(base: string): Promise<string | null> {
  for (const name of ["__Secure-better-auth.session_token", "better-auth.session_token"]) {
    const cookie = await chrome.cookies.get({ url: base, name });
    if (cookie?.value) return cookie.value;
  }
  return null;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = await baseUrl();
  const token = await sessionToken(base);
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!res.ok) {
    const message = res.status === 401 ? "Not signed in" : res.status === 429 ? "Too many requests. Wait a moment and try again." : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const logEvent = (action: string, itemId?: string) =>
  api("/api/extension/log", { method: "POST", body: JSON.stringify({ action, itemId }) }).catch(() => undefined);

// ---------- unlocked state ----------
// chrome.storage.session lives in memory only (never written to disk), is not
// readable by content scripts, and is cleared when the browser closes.

type Session = { pkcs8: string; autoLockMinutes: number; lastUsed: number };
const LOCK_ALARM = "veylix-auto-lock";

async function getSession(): Promise<Session | null> {
  const { vault } = await chrome.storage.session.get("vault");
  const session = vault as Session | undefined;
  if (!session) return null;
  if (Date.now() - session.lastUsed > session.autoLockMinutes * 60_000) {
    await lock();
    return null;
  }
  return session;
}

async function touch(session: Session) {
  session.lastUsed = Date.now();
  await chrome.storage.session.set({ vault: session });
  await chrome.alarms.create(LOCK_ALARM, { delayInMinutes: session.autoLockMinutes });
}

async function lock() {
  await chrome.storage.session.remove("vault");
  await chrome.alarms.clear(LOCK_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LOCK_ALARM) void lock();
});

// ---------- biometric unlock ----------
// chrome.storage.local keeps the private key encrypted with a key derived from
// the authenticator's PRF output, which is only released after a fingerprint.

type StoredBiometric = BiometricInfo & { wrappedKey: string; publicKey: string; baseUrl: string };

async function biometricKey(prfB64: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", fromB64(prfB64), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("veylix-ext-biometric-v1") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function storedBiometric(account: Account | null): Promise<StoredBiometric | null> {
  const { biometric } = await chrome.storage.local.get("biometric");
  const stored = biometric as StoredBiometric | undefined;
  // Only valid for the same Veylix server and the same vault key pair.
  if (!stored || !account || stored.publicKey !== account.publicKey || stored.baseUrl !== (await baseUrl())) return null;
  return stored;
}

const biometricInfo = (s: StoredBiometric | null): BiometricInfo | null => (s ? { credentialId: s.credentialId, salt: s.salt } : null);

/** Opens the extension UI in a small window (the WebAuthn prompt would close the toolbar popup). */
async function openWindow(params: Record<string, string>) {
  const url = chrome.runtime.getURL(`popup.html?${new URLSearchParams({ window: "1", ...params })}`);
  await chrome.windows.create({ url, type: "popup", width: 380, height: 620, focused: true });
}

async function privateKey(): Promise<CryptoKey> {
  const session = await getSession();
  if (!session) throw new Error("Vault is locked");
  await touch(session);
  return importPrivateKey(fromB64(session.pkcs8));
}

// ---------- vault data ----------

async function decryptLogins(payload: VaultPayload): Promise<Login[]> {
  if (!payload.snapshot) return [];
  const key = await privateKey();
  const folderKeys = new Map<string, Promise<CryptoKey>>();
  const folderKey = (folder: FolderRecord) => {
    if (!folderKeys.has(folder.id)) folderKeys.set(folder.id, openKeyForUser(folder.encryptedFolderKey!, key));
    return folderKeys.get(folder.id)!;
  };

  const results = await Promise.all(
    payload.snapshot.items
      .filter((i) => i.type === "LOGIN")
      .map(async (item): Promise<Login | null> => {
        try {
          let itemKey: CryptoKey;
          if (item.via === "share") itemKey = await openKeyForUser(item.shareKey!, key);
          else {
            const folder = payload.snapshot!.folders.find((f) => f.id === item.folderId);
            if (!folder?.encryptedFolderKey) return null;
            itemKey = await unwrapKey(item.encryptedItemKey, await folderKey(folder));
          }
          const data = await decryptJSON<{ username: string; password: string }>(itemKey, item.encryptedData);
          return { id: item.id, name: item.name, url: item.url, folderName: item.folderName, username: data.username, password: data.password, favorite: item.favorite };
        } catch {
          return null;
        }
      }),
  );
  return results.filter((l): l is Login => l !== null);
}

async function loadLogins(): Promise<Login[]> {
  return decryptLogins(await api<VaultPayload>("/api/extension/vault"));
}

async function findLogin(itemId: string): Promise<Login> {
  const login = (await loadLogins()).find((l) => l.id === itemId);
  if (!login) throw new Error("Login not found");
  return login;
}

function sortForPage(logins: Login[], url?: string) {
  const scored = logins.map((l) => ({ l, score: matchScore(l.url, url) }));
  const matches = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.l.name.localeCompare(b.l.name)).map((s) => s.l);
  const others = scored.filter((s) => s.score === 0).map((s) => s.l).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  return { matches, others };
}

// ---------- filling ----------

/** Injected into the page: finds the login form and fills it like a user would. */
function fillCredentials(username: string, password: string): boolean {
  const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const setValue = (el: HTMLInputElement, value: string) => {
    // Use the native setter so React/Angular/Vue notice the change.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    el.focus();
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  };

  const passwordField = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).find(visible);
  const textFields = Array.from(document.querySelectorAll<HTMLInputElement>("input")).filter(
    (i) => visible(i) && ["text", "email", "tel", ""].includes(i.type) && !i.disabled && !i.readOnly,
  );
  // Username = the last text-like field before the password field (or the first one if no password field yet).
  const userField = passwordField
    ? textFields.filter((i) => i.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING).pop()
    : textFields.find((i) => /user|email|login|mail/i.test(`${i.name} ${i.id} ${i.autocomplete} ${i.placeholder}`));

  if (!passwordField && !userField) return false;
  if (userField && username) setValue(userField, username);
  if (passwordField && password) setValue(passwordField, password);
  return true;
}

async function fillTab(tabId: number, login: Login) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: fillCredentials,
    args: [login.username, login.password],
  });
  if (!results.some((r) => r.result)) throw new Error("No login form found on this page");
  void logEvent("AUTOFILLED", login.id);
}

function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ---------- message handling ----------

async function status(): Promise<Status> {
  const base = await baseUrl();
  try {
    const payload = await api<VaultPayload>("/api/extension/vault");
    if (!payload.account) return { state: "no-vault", baseUrl: base, user: payload.user };
    const biometric = biometricInfo(await storedBiometric(payload.account));
    return { state: (await getSession()) ? "unlocked" : "locked", baseUrl: base, user: payload.user, biometric };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await lock();
      return { state: "signed-out", baseUrl: base };
    }
    return { state: "error", baseUrl: base, message: `Can't reach Veylix at ${base}` };
  }
}

async function handle(message: Request, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "status":
      return status();

    case "unlock": {
      const payload = await api<VaultPayload>("/api/extension/vault");
      if (!payload.account) throw new Error("Set up your vault in Veylix first");
      const pkcs8 = await unlockPrivateKeyBytes(message.password, payload.account);
      await touch({ pkcs8: toB64(pkcs8), autoLockMinutes: payload.account.autoLockMinutes, lastUsed: Date.now() });
      void logEvent("EXTENSION_UNLOCKED");
      return null;
    }

    case "lock":
      await lock();
      return null;

    case "logins":
      return sortForPage(await loadLogins(), message.url);

    case "fill":
      await fillTab(message.tabId, await findLogin(message.itemId));
      return null;

    case "openAndFill": {
      const login = await findLogin(message.itemId);
      if (!login.url) throw new Error("This login has no website");
      const tab = await chrome.tabs.create({ url: login.url });
      await waitForLoad(tab.id!);
      await fillTab(tab.id!, login);
      return null;
    }

    case "setBaseUrl": {
      const url = new URL(message.baseUrl);
      await chrome.storage.local.set({ baseUrl: url.origin });
      await chrome.storage.local.remove("biometric");
      await lock();
      return null;
    }

    case "enableBiometric": {
      const session = await getSession();
      if (!session) throw new Error("Unlock with your master password first");
      const payload = await api<VaultPayload>("/api/extension/vault");
      if (!payload.account) throw new Error("No vault found");
      const stored: StoredBiometric = {
        credentialId: message.credentialId,
        salt: message.salt,
        wrappedKey: await encryptString(await biometricKey(message.prf), session.pkcs8),
        publicKey: payload.account.publicKey,
        baseUrl: await baseUrl(),
      };
      await chrome.storage.local.set({ biometric: stored });
      return null;
    }

    case "disableBiometric":
      await chrome.storage.local.remove("biometric");
      return null;

    case "biometricUnlock": {
      const payload = await api<VaultPayload>("/api/extension/vault");
      const stored = await storedBiometric(payload.account);
      if (!stored || !payload.account) throw new Error("Biometric unlock isn't set up. Use your master password.");
      let pkcs8: string;
      try {
        pkcs8 = await decryptString(await biometricKey(message.prf), stored.wrappedKey);
        await importPrivateKey(fromB64(pkcs8)); // sanity check
      } catch {
        throw new Error("Biometric unlock failed. Use your master password.");
      }
      await touch({ pkcs8, autoLockMinutes: payload.account.autoLockMinutes, lastUsed: Date.now() });
      void logEvent("EXTENSION_UNLOCKED");
      return null;
    }

    case "openWindow":
      await openWindow(message.params);
      return null;

    case "openUnlock": {
      // Clicking the in-page icon while locked opens the unlock screen.
      try {
        await chrome.action.openPopup();
      } catch {
        await openWindow(sender.tab?.id ? { tab: String(sender.tab.id) } : {});
      }
      return null;
    }

    case "logCopy":
      void logEvent(message.what === "password" ? "PASSWORD_COPIED" : "USERNAME_COPIED", message.itemId);
      return null;

    case "pageMatches": {
      // Content scripts only get names/usernames; passwords stay in the extension.
      if (!(await getSession())) return { locked: true, matches: [] };
      const { matches } = sortForPage(await loadLogins(), sender.tab?.url);
      return { locked: false, matches: matches.map<LoginSummary>(({ id, name, url, username }) => ({ id, name, url, username })) };
    }

    case "fillHere": {
      if (!sender.tab?.id) throw new Error("No tab");
      const login = await findLogin(message.itemId);
      if (matchScore(login.url, sender.tab.url) === 0) throw new Error("This login is for a different website");
      await fillTab(sender.tab.id, login);
      return null;
    }
  }
}

chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse: (r: Response) => void) => {
  handle(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : "Something went wrong" }));
  return true; // keep the channel open for the async response
});
