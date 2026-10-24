// In-page autofill: shows a Veylix icon in login fields. Clicking it lists the
// saved logins for this site (names/usernames only) and fills the chosen one.
// Passwords never enter this script; the background worker injects them.

import { DEFAULT_BASE_URL, send, type LoginSummary } from "./shared";

const HOST_ID = "veylix-autofill-host";
let host: HTMLElement | null = null;
let shadow: ShadowRoot;
let target: HTMLInputElement | null = null;

const ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';

const STYLE = `
  :host { all: initial; }
  .btn { position: fixed; z-index: 2147483646; display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 6px;
         background: linear-gradient(135deg, #2563eb, #059669); color: #fff; cursor: pointer; box-shadow: 0 1px 3px rgb(0 0 0 / .25); padding: 0; }
  .btn:hover { filter: brightness(1.1); }
  .menu { position: fixed; z-index: 2147483647; width: 280px; max-height: 260px; overflow-y: auto; border-radius: 10px; padding: 6px;
          background: #fff; color: #0a0a0a; box-shadow: 0 0 0 1px rgb(0 0 0 / .08), 0 10px 30px rgb(0 0 0 / .18);
          font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; }
  @media (prefers-color-scheme: dark) { .menu { background: #171717; color: #fafafa; box-shadow: 0 0 0 1px rgb(255 255 255 / .1), 0 10px 30px rgb(0 0 0 / .5); } .muted { color: #a3a3a3 !important; } .opt:hover { background: #262626 !important; } }
  .head { display: flex; align-items: center; gap: 6px; padding: 4px 6px 8px; font-weight: 600; font-size: 12px; }
  .head span { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; background: linear-gradient(135deg, #2563eb, #059669); color: #fff; }
  .opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border: 0; border-radius: 8px; background: none; color: inherit; text-align: left; cursor: pointer; font: inherit; }
  .opt:hover { background: #f5f5f5; }
  .av { flex-shrink: 0; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; background: #2563eb; color: #fff; font-weight: 600; text-transform: uppercase; }
  .meta { min-width: 0; } .meta p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name { font-weight: 500; } .muted { color: #737373; font-size: 12px; }
  .note { padding: 10px 8px; color: #737373; font-size: 12px; }
`;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

function ensureHost() {
  if (host?.isConnected) return;
  host = document.createElement("div");
  host.id = HOST_ID;
  shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>${STYLE}</style><button class="btn" title="Fill with Veylix" aria-label="Fill with Veylix">${ICON}</button><div class="menu" hidden></div>`;
  document.documentElement.appendChild(host);
  shadow.querySelector(".btn")!.addEventListener("mousedown", (e) => {
    e.preventDefault(); // keep focus in the field
    void toggleMenu();
  });
}

const button = () => shadow.querySelector<HTMLButtonElement>(".btn")!;
const menu = () => shadow.querySelector<HTMLDivElement>(".menu")!;

/** The field to decorate: the username field before a password box, else the password box. */
function findTarget(): HTMLInputElement | null {
  const password = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).find(visible);
  if (!password) return null;
  const user = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type]), input[type="text"], input[type="email"], input[type="tel"]'))
    .filter((i) => visible(i) && i.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING)
    .pop();
  return user ?? password;
}

function position() {
  if (!host || !target || !target.isConnected || !visible(target)) {
    if (host) host.style.display = "none";
    return;
  }
  host.style.display = "";
  const r = target.getBoundingClientRect();
  const b = button();
  b.style.top = `${r.top + (r.height - 22) / 2}px`;
  b.style.left = `${r.right - 22 - 8}px`;
  const m = menu();
  m.style.top = `${r.bottom + 6}px`;
  m.style.left = `${Math.max(8, Math.min(r.right - 280, window.innerWidth - 288))}px`;
}

async function toggleMenu() {
  const m = menu();
  if (!m.hidden) return void (m.hidden = true);

  const res = await send<{ locked: boolean; matches: LoginSummary[] }>({ type: "pageMatches" });
  // Locked: open the extension's unlock screen (master password or fingerprint).
  // The password is never typed into this page.
  if (res.ok && res.data.locked) return void send({ type: "openUnlock" });

  m.hidden = false;
  position();
  const head = `<div class="head"><span>${ICON}</span>Veylix</div>`;
  if (!res.ok) return void (m.innerHTML = `${head}<p class="note">${escape(res.error)}</p>`);
  if (!res.data.matches.length) return void (m.innerHTML = `${head}<p class="note">No saved logins for this site.</p>`);

  m.innerHTML =
    head +
    res.data.matches
      .map(
        (l) => `<button class="opt" data-id="${l.id}"><span class="av">${escape(l.name[0] ?? "?")}</span>
          <span class="meta"><p class="name">${escape(l.name)}</p><p class="muted">${escape(l.username || "No username")}</p></span></button>`,
      )
      .join("");
  m.querySelectorAll<HTMLButtonElement>(".opt").forEach((opt) =>
    opt.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      m.hidden = true;
      const r = await send({ type: "fillHere", itemId: opt.dataset.id! });
      if (!r.ok) alert(`Veylix: ${r.error}`);
    }),
  );
}

function scan() {
  const next = findTarget();
  if (next !== target) {
    target = next;
    if (target) ensureHost();
    if (host) menu().hidden = true;
  }
  position();
}

// Login forms are often rendered late by SPAs, so keep watching the page.
let scheduled = false;
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
};

async function start() {
  // Don't decorate Veylix's own pages (its sign-in form isn't a saved site).
  const { baseUrl } = await chrome.storage.local.get("baseUrl");
  if (location.origin === (typeof baseUrl === "string" && baseUrl ? baseUrl : DEFAULT_BASE_URL)) return;

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["type", "style", "class", "hidden"] });
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  document.addEventListener("mousedown", (e) => {
    if (host && !e.composedPath().includes(host)) menu().hidden = true;
  });
  scan();
}

void start();
