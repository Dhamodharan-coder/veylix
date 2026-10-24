// Types and helpers shared by the background worker, popup and content script.

export type Login = {
  id: string;
  name: string;
  url: string | null;
  folderName: string;
  username: string;
  password: string;
  favorite: boolean;
};

/** Safe-to-share summary (no password) for the in-page suggestion list. */
export type LoginSummary = Pick<Login, "id" | "name" | "url" | "username">;

type User = { name: string; email: string };

/** Biometric unlock configured on this device: WebAuthn credential + PRF salt. */
export type BiometricInfo = { credentialId: string; salt: string };

export type Status =
  | { state: "signed-out"; baseUrl: string }
  | { state: "no-vault"; baseUrl: string; user: User }
  | { state: "locked"; baseUrl: string; user: User; biometric: BiometricInfo | null }
  | { state: "unlocked"; baseUrl: string; user: User; biometric: BiometricInfo | null }
  | { state: "error"; baseUrl: string; message: string };

export type Request =
  | { type: "status" }
  | { type: "unlock"; password: string }
  | { type: "lock" }
  | { type: "logins"; url?: string }
  | { type: "fill"; itemId: string; tabId: number }
  | { type: "openAndFill"; itemId: string }
  | { type: "setBaseUrl"; baseUrl: string }
  | { type: "logCopy"; itemId: string; what: "username" | "password" }
  // biometric unlock (the WebAuthn ceremony runs in an extension window)
  | { type: "enableBiometric"; credentialId: string; salt: string; prf: string }
  | { type: "disableBiometric" }
  | { type: "biometricUnlock"; prf: string }
  | { type: "openWindow"; params: Record<string, string> }
  // from the content script
  | { type: "pageMatches" }
  | { type: "fillHere"; itemId: string }
  | { type: "openUnlock" };

export type Response<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export function send<T>(message: Request): Promise<Response<T>> {
  return chrome.runtime.sendMessage(message);
}

export const DEFAULT_BASE_URL = "http://localhost:3000";

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** "gateway.dev.propgoto.app" → "propgoto.app" (simple two-label base domain). */
const baseDomain = (host: string) => host.split(".").slice(-2).join(".");

/**
 * How well a saved login's URL matches the page: 2 = same host (or subdomain),
 * 1 = same base domain, 0 = no match.
 */
export function matchScore(itemUrl: string | null, pageUrl: string | null | undefined): number {
  const item = hostOf(itemUrl);
  const page = hostOf(pageUrl);
  if (!item || !page) return 0;
  if (item === page || page.endsWith(`.${item}`) || item.endsWith(`.${page}`)) return 2;
  return baseDomain(item) === baseDomain(page) ? 1 : 0;
}

export const displayHost = (url: string | null | undefined) => hostOf(url) ?? "";
