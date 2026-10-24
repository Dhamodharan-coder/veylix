import { displayHost, send, type Login, type SavePrompt, type Status } from "./shared";
import { biometricLabel, biometricSupported, evaluateBiometric, registerBiometric } from "./biometric";

// The UI also runs in a standalone window (opened for fingerprint prompts or
// from the in-page icon), which needs to know which tab to fill.
const params = new URLSearchParams(location.search);
const windowMode = params.has("window");
const targetTabId = Number(params.get("tab")) || undefined;
if (windowMode) document.body.classList.add("window");

const view = document.getElementById("view")!;
const subtitle = document.getElementById("subtitle")!;
const lockBtn = document.getElementById("lock-btn")!;
const settingsBtn = document.getElementById("settings-btn")!;
const toastEl = document.getElementById("toast")!;

const ICONS = {
  fill: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  open: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  fingerprint: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
};

const COLORS = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#e11d48", "#0891b2", "#4f46e5", "#0d9488"];
const colorFor = (name: string) => COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % COLORS.length];

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let toastTimer: number | undefined;
function toast(message: string, error = false) {
  toastEl.textContent = message;
  toastEl.className = `toast${error ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  if (targetTabId) return chrome.tabs.get(targetTabId).catch(() => undefined);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Opens the UI in its own window (fingerprint prompts would close the toolbar popup). */
async function openInWindow(extra: Record<string, string>) {
  const tab = await activeTab();
  await send({ type: "openWindow", params: { ...(tab?.id ? { tab: String(tab.id) } : {}), ...extra } });
  window.close();
}

const openVeylix = (base: string, path = "/vault") => chrome.tabs.create({ url: `${base}${path}` });

// ---------- screens ----------

function renderMessage(icon: string, title: string, body: string, actionLabel?: string, action?: () => void) {
  view.innerHTML = `
    <div class="center">
      <div class="badge-icon">${icon}</div>
      <p style="margin:4px 0 0;font-weight:600;font-size:15px">${escape(title)}</p>
      <p class="muted" style="margin:0">${escape(body)}</p>
      ${actionLabel ? `<button class="btn" id="msg-action" style="margin-top:6px">${escape(actionLabel)}</button>` : ""}
    </div>`;
  if (action) document.getElementById("msg-action")!.addEventListener("click", action);
}

async function renderUnlock(status: Extract<Status, { state: "locked" }>) {
  view.innerHTML = `
    <form class="pad" id="unlock-form" style="flex:1;justify-content:center">
      <div class="center" style="padding:8px 0 4px;flex:0">
        <div class="badge-icon">${ICONS.lock}</div>
        <p style="margin:4px 0 0;font-weight:600;font-size:15px">Unlock your vault</p>
        <p class="muted" style="margin:0">${escape(status.user.email)}</p>
      </div>
      <div class="field">
        <label for="master">Master password</label>
        <input id="master" type="password" autocomplete="current-password" required autofocus />
      </div>
      <p class="error hidden" id="unlock-error"></p>
      <button class="btn block" id="unlock-btn">Unlock</button>
      <button class="btn outline block hidden" type="button" id="bio-btn">${ICONS.fingerprint} Unlock with ${biometricLabel()}</button>
      <p class="muted" style="margin:0;font-size:11px;text-align:center">Decrypted on this device only. Your master password is never sent.</p>
    </form>`;
  const form = document.getElementById("unlock-form") as HTMLFormElement;
  const input = document.getElementById("master") as HTMLInputElement;
  const btn = document.getElementById("unlock-btn") as HTMLButtonElement;
  const bioBtn = document.getElementById("bio-btn") as HTMLButtonElement;
  const error = document.getElementById("unlock-error")!;
  const showError = (message: string) => {
    error.textContent = message;
    error.classList.remove("hidden");
  };

  const biometric = status.biometric;
  if (biometric && (await biometricSupported())) {
    bioBtn.classList.remove("hidden");
    const unlockWithBiometric = async () => {
      // The OS prompt steals focus and would close the toolbar popup, so use a window.
      if (!windowMode) return openInWindow({ bio: "1" });
      bioBtn.disabled = true;
      error.classList.add("hidden");
      try {
        const res = await send({ type: "biometricUnlock", prf: await evaluateBiometric(biometric.credentialId, biometric.salt) });
        if (!res.ok) throw new Error(res.error);
        await refresh();
      } catch (e) {
        bioBtn.disabled = false;
        showError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : `${biometricLabel()} was cancelled.`);
      }
    };
    bioBtn.addEventListener("click", unlockWithBiometric);
    // Opened specifically for a fingerprint unlock: start right away.
    if (windowMode && params.has("bio")) {
      params.delete("bio");
      void unlockWithBiometric();
      return;
    }
  }
  input.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = "Unlocking…";
    error.classList.add("hidden");
    const res = await send({ type: "unlock", password: input.value });
    if (!res.ok) {
      showError(res.error);
      btn.disabled = false;
      btn.textContent = "Unlock";
      input.select();
      return;
    }
    await refresh();
  });
}

async function renderVault(status: Extract<Status, { state: "unlocked" }>) {
  view.innerHTML = `<div class="center muted">Decrypting…</div>`;
  const tab = await activeTab();
  const pageUrl = tab?.url && /^https?:/.test(tab.url) ? tab.url : undefined;
  const res = await send<{ matches: Login[]; others: Login[] }>({ type: "logins", url: pageUrl });
  if (!res.ok) return renderMessage(ICONS.shield, "Couldn't load your vault", res.error, "Try again", refresh);
  const { matches, others } = res.data;
  const host = displayHost(pageUrl);

  view.innerHTML = `
    <div id="pending-save"></div>
    <div class="search"><input id="search" type="search" placeholder="Search all logins…" autocomplete="off" /></div>
    <div id="lists"></div>
    <div class="footer">
      <button class="link" id="open-app">Open Veylix</button>
      <button class="link" id="add-login">+ Add login</button>
    </div>`;

  const lists = document.getElementById("lists")!;
  if (tab?.id) void renderPendingSave(tab.id);
  const row = (l: Login, canFill: boolean) => `
    <li class="item" data-id="${l.id}">
      <span class="avatar" style="background:${colorFor(l.name)}">${escape(l.name[0] ?? "?")}</span>
      <div class="meta">
        <p class="name">${escape(l.name)}</p>
        <p class="sub">${escape(l.username || displayHost(l.url) || l.folderName)}</p>
      </div>
      <div class="row-actions">
        ${canFill ? `<button class="icon-btn" data-act="fill" title="Fill on this page" aria-label="Fill">${ICONS.fill}</button>` : ""}
        <button class="icon-btn" data-act="user" title="Copy username" aria-label="Copy username">${ICONS.user}</button>
        <button class="icon-btn" data-act="pass" title="Copy password" aria-label="Copy password">${ICONS.copy}</button>
        ${l.url ? `<button class="icon-btn" data-act="open" title="Open & fill" aria-label="Open and fill">${ICONS.open}</button>` : ""}
      </div>
    </li>`;

  const draw = (query: string) => {
    const q = query.trim().toLowerCase();
    const filter = (l: Login) => !q || `${l.name} ${l.username} ${l.url ?? ""}`.toLowerCase().includes(q);
    const m = matches.filter(filter);
    const o = others.filter(filter);
    lists.innerHTML = `
      ${pageUrl && !q ? `<p class="section">Suggested for ${escape(host)}</p>${m.length ? `<ul class="list">${m.map((l) => row(l, true)).join("")}</ul>` : `<p class="empty">No saved logins for this site.</p>`}` : ""}
      ${q ? `<p class="section">Results</p>` : `<p class="section">All logins</p>`}
      ${(q ? [...m, ...o] : o).length ? `<ul class="list">${(q ? [...m, ...o] : o).map((l) => row(l, !!pageUrl)).join("")}</ul>` : `<p class="empty">${q ? "No logins match." : "No other logins."}</p>`}`;
  };
  draw("");

  document.getElementById("search")!.addEventListener("input", (e) => draw((e.target as HTMLInputElement).value));
  document.getElementById("open-app")!.addEventListener("click", () => openVeylix(status.baseUrl));
  document.getElementById("add-login")!.addEventListener("click", () => openVeylix(status.baseUrl));

  const all = [...matches, ...others];
  lists.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    const id = btn?.closest<HTMLElement>(".item")?.dataset.id;
    const login = all.find((l) => l.id === id);
    if (!btn || !login) return;

    if (btn.dataset.act === "user" || btn.dataset.act === "pass") {
      const value = btn.dataset.act === "user" ? login.username : login.password;
      if (!value) return toast(`No ${btn.dataset.act === "user" ? "username" : "password"} saved`, true);
      await navigator.clipboard.writeText(value);
      void send({ type: "logCopy", itemId: login.id, what: btn.dataset.act === "user" ? "username" : "password" });
      return toast(`${btn.dataset.act === "user" ? "Username" : "Password"} copied`);
    }
    if (btn.dataset.act === "fill" && tab?.id) {
      const res = await send({ type: "fill", itemId: login.id, tabId: tab.id });
      if (!res.ok) return toast(res.error, true);
      if (windowMode) await chrome.tabs.update(tab.id, { active: true });
      window.close();
    }
    if (btn.dataset.act === "open") {
      const res = await send({ type: "openAndFill", itemId: login.id });
      if (!res.ok) toast(res.error, true);
    }
  });
}

/** Creates the device credential and encrypts the vault key with the fingerprint secret. */
async function setUpBiometric(status: Extract<Status, { state: "unlocked" }>) {
  try {
    const reg = await registerBiometric(status.user.email);
    const res = await send({ type: "enableBiometric", ...reg });
    if (!res.ok) throw new Error(res.error);
    toast(`${biometricLabel()} unlock is on`);
    await refresh();
  } catch (e) {
    toast(e instanceof Error && e.name !== "NotAllowedError" ? e.message : `${biometricLabel()} setup was cancelled`, true);
  }
}

function renderBiometricSetup(status: Extract<Status, { state: "unlocked" }>) {
  view.innerHTML = `
    <div class="center">
      <div class="badge-icon">${ICONS.fingerprint}</div>
      <p style="margin:4px 0 0;font-weight:600;font-size:15px">Unlock with ${biometricLabel()}</p>
      <p class="muted" style="margin:0">Your device will ask for your fingerprint. Your master password still works and is never stored.</p>
      <button class="btn" id="bio-setup" style="margin-top:6px">${ICONS.fingerprint} Set up ${biometricLabel()}</button>
    </div>`;
  document.getElementById("bio-setup")!.addEventListener("click", () => setUpBiometric(status));
}

/** A login captured on this tab that is waiting to be saved (e.g. after "Unlock & save"). */
async function renderPendingSave(tabId: number) {
  const box = document.getElementById("pending-save");
  const res = await send<SavePrompt | null>({ type: "pendingSave", tabId });
  if (!box || !res.ok || !res.data || res.data.locked) return;
  const p = res.data;
  box.innerHTML = `
    <div style="margin:10px 14px 0;padding:12px;border-radius:10px;background:rgb(37 99 235 / .08);box-shadow:inset 0 0 0 1px rgb(37 99 235 / .25)">
      <p style="margin:0;font-weight:600">${p.kind === "update" ? `Update password for ${escape(p.name)}?` : `Save login for ${escape(p.host)}?`}</p>
      ${p.username ? `<p class="muted" style="margin:2px 0 0;font-size:12px">${escape(p.username)}</p>` : ""}
      ${p.breached ? `<p style="margin:6px 0 0;font-size:12px;color:var(--destructive)">⚠ Found in ${p.breached.toLocaleString()} data breaches</p>` : ""}
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn sm" id="ps-save">${p.kind === "update" ? "Update" : "Save"}</button>
        <button class="btn sm outline" id="ps-later">Not now</button>
      </div>
    </div>`;
  document.getElementById("ps-later")!.addEventListener("click", async () => {
    await send({ type: "dismissPending", tabId });
    box.innerHTML = "";
  });
  document.getElementById("ps-save")!.addEventListener("click", async () => {
    const r = await send<string>({ type: "savePending", tabId, name: p.name, folderId: p.defaultFolderId ?? "" });
    if (!r.ok) return toast(r.error, true);
    toast(r.data === "updated" ? "Password updated" : "Saved to Veylix");
    await refresh();
  });
}

async function renderSettings(status: Status) {
  const unlocked = status.state === "unlocked";
  const supported = unlocked && (await biometricSupported());
  const bioOn = unlocked && !!status.biometric;
  view.innerHTML = `
    <form class="pad" id="settings-form">
      <p style="margin:0;font-weight:600;font-size:15px">Settings</p>
      ${
        unlocked
          ? `<div class="field">
              <label>Unlock with ${biometricLabel()}</label>
              ${
                supported
                  ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                      <span class="muted" style="font-size:12px">${bioOn ? "On for this browser" : "Use your fingerprint instead of typing your master password."}</span>
                      <button class="btn sm ${bioOn ? "outline" : ""}" type="button" id="bio-toggle">${bioOn ? "Turn off" : "Turn on"}</button>
                    </div>`
                  : `<span class="muted" style="font-size:12px">Not available on this device.</span>`
              }
            </div>`
          : ""
      }
      <div class="field">
        <label for="base-url">Veylix URL</label>
        <input id="base-url" type="url" required value="${escape(status.baseUrl)}" placeholder="https://veylix.example.com" />
        <p class="muted" style="margin:0;font-size:11px">The address where you open Veylix. Changing it locks the extension.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" type="submit">Save</button>
        <button class="btn outline" type="button" id="cancel-settings">Cancel</button>
      </div>
    </form>`;
  document.getElementById("bio-toggle")?.addEventListener("click", async () => {
    if (status.state !== "unlocked") return;
    if (bioOn) {
      await send({ type: "disableBiometric" });
      toast(`${biometricLabel()} unlock is off`);
      return refresh();
    }
    if (!windowMode) return openInWindow({ setupBio: "1" });
    await setUpBiometric(status);
  });
  document.getElementById("cancel-settings")!.addEventListener("click", refresh);
  document.getElementById("settings-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await send({ type: "setBaseUrl", baseUrl: (document.getElementById("base-url") as HTMLInputElement).value });
    if (!res.ok) return toast(res.error, true);
    toast("Saved");
    await refresh();
  });
}

// ---------- main ----------

let current: Status | null = null;

async function refresh() {
  const res = await send<Status>({ type: "status" });
  if (!res.ok) return renderMessage(ICONS.shield, "Something went wrong", res.error, "Try again", refresh);
  const status = (current = res.data);
  lockBtn.classList.toggle("hidden", status.state !== "unlocked");
  subtitle.textContent = "user" in status ? status.user.email : "Password Vault";

  switch (status.state) {
    case "signed-out":
      return renderMessage(ICONS.shield, "Sign in to Veylix", "Sign in on the Veylix website, then open the extension again.", "Open Veylix", () => openVeylix(status.baseUrl, "/sign-in"));
    case "no-vault":
      return renderMessage(ICONS.shield, "Set up your vault", "Create your master password in Veylix first.", "Open Veylix", () => openVeylix(status.baseUrl));
    case "error":
      return renderMessage(ICONS.shield, "Can't connect", `${status.message}. Check the URL in settings.`, "Settings", () => renderSettings(status));
    case "locked":
      return renderUnlock(status);
    case "unlocked":
      if (windowMode && params.has("setupBio")) {
        params.delete("setupBio");
        return renderBiometricSetup(status);
      }
      return renderVault(status);
  }
}

lockBtn.addEventListener("click", async () => {
  await send({ type: "lock" });
  toast("Vault locked");
  await refresh();
});
settingsBtn.addEventListener("click", () => current && renderSettings(current));

void refresh();
