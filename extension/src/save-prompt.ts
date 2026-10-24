// "Save this login to Veylix?" prompt. Captures credentials when a login form
// is submitted, then asks the background worker whether to offer save/update.
// The captured password goes only to the extension; the prompt never receives it back.

import { send, type SavePrompt } from "./shared";

const LOGO =
  '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><defs><linearGradient id="vx" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#059669"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#vx)"/><path d="m11.4 11.6 4.6 9 4.6-9" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const STYLE = `
  :host { all: initial; }
  .card { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 340px; box-sizing: border-box; padding: 16px;
          border-radius: 14px; background: #fff; color: #0a0a0a; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
          box-shadow: 0 0 0 1px rgb(0 0 0 / .08), 0 16px 40px rgb(0 0 0 / .18); animation: in .18s ease-out; }
  @keyframes in { from { opacity: 0; transform: translateY(-8px); } }
  @media (prefers-color-scheme: dark) {
    .card { background: #171717; color: #fafafa; box-shadow: 0 0 0 1px rgb(255 255 255 / .1), 0 16px 40px rgb(0 0 0 / .5); }
    .muted { color: #a3a3a3 !important; } input, select { background: #0a0a0a !important; color: #fafafa !important; border-color: #333 !important; }
    .ghost:hover { background: #262626 !important; } .ok { background: rgb(74 222 128 / .12) !important; }
  }
  .head { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 10px; }
  .x { margin-left: auto; border: 0; background: none; color: inherit; opacity: .55; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 4px; }
  .x:hover { opacity: 1; }
  .title { margin: 0; font-size: 14px; font-weight: 600; word-break: break-word; }
  .muted { color: #737373; font-size: 12px; margin: 2px 0 0; word-break: break-all; }
  .warn { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: rgb(220 38 38 / .1); color: #dc2626; font-size: 12px; }
  .ok { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: rgb(22 163 74 / .1); color: #16a34a; font-size: 12px; }
  label { display: block; margin-top: 10px; font-size: 12px; font-weight: 500; }
  input, select { width: 100%; box-sizing: border-box; margin-top: 4px; height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid #e5e5e5; font: inherit; background: #fff; color: #0a0a0a; }
  .row { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  button.primary { height: 32px; padding: 0 14px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font: inherit; font-weight: 500; cursor: pointer; }
  button.primary:hover { background: #1d4ed8; } button.primary:disabled { opacity: .6; cursor: default; }
  button.ghost { height: 32px; padding: 0 12px; border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; cursor: pointer; }
  button.ghost:hover { background: #f5f5f5; }
  .never { margin-left: auto; border: 0; background: none; color: #737373; font: inherit; font-size: 12px; cursor: pointer; text-decoration: underline; }
  .error { margin-top: 8px; color: #dc2626; font-size: 12px; }
`;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
const formatCount = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

let host: HTMLElement | null = null;
let shadow: ShadowRoot;
let lastCapture = "";

/** Reads the login currently typed into the page (if a password is present). */
function readCredentials(): { username: string; password: string } | null {
  const password = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).find((i) => visible(i) && i.value);
  if (!password) return null;
  const user = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type]), input[type="text"], input[type="email"], input[type="tel"]'))
    .filter((i) => visible(i) && i.value && i.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING)
    .pop();
  return { username: user?.value.trim() ?? "", password: password.value };
}

function capture() {
  const creds = readCredentials();
  if (!creds) return;
  const signature = `${creds.username}\u0000${creds.password}`;
  if (signature === lastCapture) return;
  lastCapture = signature;
  void send({ type: "captureLogin", ...creds });
  // SPAs often log in without navigating; ask shortly after the submit.
  setTimeout(() => void check(), 1500);
}

function close() {
  host?.remove();
  host = null;
}

async function check() {
  if (host) return;
  const res = await send<SavePrompt | null>({ type: "pendingSave" });
  if (res.ok && res.data) render(res.data);
}

function render(p: SavePrompt) {
  close();
  host = document.createElement("div");
  shadow = host.attachShadow({ mode: "closed" });
  const title = p.kind === "update" ? `Update password for ${escape(p.name)}?` : `Save login for ${escape(p.host)}?`;
  const breach =
    p.breached && p.breached > 0
      ? `<div class="warn">⚠ This password appeared in ${formatCount(p.breached)} data breaches. Consider changing it.</div>`
      : p.breached === 0
        ? `<div class="ok">✓ Not found in known data breaches</div>`
        : "";

  const body = p.locked
    ? `<p class="muted" style="margin-top:8px">Unlock Veylix to save this login securely.</p>
       <div class="row"><button class="primary" data-act="unlock">Unlock &amp; save</button><button class="ghost" data-act="later">Not now</button></div>`
    : `${
        p.kind === "save"
          ? `<label>Name<input data-field="name" value="${escape(p.name)}" maxlength="100" /></label>${
              p.folders.length > 1
                ? `<label>Folder<select data-field="folder">${p.folders
                    .map((f) => `<option value="${f.id}"${f.id === p.defaultFolderId ? " selected" : ""}>${escape(f.name)}</option>`)
                    .join("")}</select></label>`
                : ""
            }`
          : ""
      }
       <div class="row"><button class="primary" data-act="save">${p.kind === "update" ? "Update" : "Save"}</button><button class="ghost" data-act="later">Not now</button>
       ${p.kind === "save" ? `<button class="never" data-act="never">Never for this site</button>` : ""}</div>
       <div class="error" hidden></div>`;

  shadow.innerHTML = `<style>${STYLE}</style>
    <div class="card" role="dialog" aria-label="Veylix">
      <div class="head">${LOGO}<span>Veylix</span><button class="x" data-act="later" aria-label="Close">×</button></div>
      <p class="title">${title}</p>
      ${p.username ? `<p class="muted">${escape(p.username)}</p>` : ""}
      ${breach}
      ${body}
    </div>`;
  document.documentElement.appendChild(host);

  shadow.addEventListener("click", async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "later") {
      void send({ type: "dismissPending" });
      return close();
    }
    if (act === "never") {
      void send({ type: "dismissPending", never: true });
      return close();
    }
    if (act === "unlock") {
      // Unlocking happens in the extension, never in the page. The prompt returns on focus.
      void send({ type: "openUnlock" });
      return close();
    }
    if (act === "save") {
      const btn = e.target as HTMLButtonElement;
      const error = shadow.querySelector<HTMLElement>(".error")!;
      btn.disabled = true;
      btn.textContent = "Saving…";
      const name = shadow.querySelector<HTMLInputElement>('[data-field="name"]')?.value ?? p.name;
      const folderId = shadow.querySelector<HTMLSelectElement>('[data-field="folder"]')?.value ?? p.defaultFolderId ?? "";
      const res = await send<string>({ type: "savePending", name, folderId });
      if (!res.ok) {
        error.textContent = res.error;
        error.hidden = false;
        btn.disabled = false;
        btn.textContent = p.kind === "update" ? "Update" : "Save";
        return;
      }
      shadow.querySelector(".card")!.innerHTML = `<div class="head">${LOGO}<span>${res.data === "updated" ? "Password updated" : "Saved to Veylix"} ✓</span></div>`;
      setTimeout(close, 1800);
    }
  });
}

export function startSavePrompt() {
  document.addEventListener("submit", capture, true);
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, input[type="submit"], input[type="button"], [role="button"], a');
      if (!el || (host && e.composedPath().includes(host))) return;
      const label = (el.textContent || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").trim();
      const isSubmit = el.matches('button[type="submit"], input[type="submit"]') || (el.tagName === "BUTTON" && !el.getAttribute("type") && !!el.closest("form"));
      if (isSubmit || /\b(log\s?in|sign\s?in|continue|next|submit|login|enter)\b/i.test(label)) capture();
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "INPUT") capture();
  }, true);
  // After a navigation (or after unlocking in the popup), offer any pending save.
  window.addEventListener("focus", () => void check());
  void check();
}
