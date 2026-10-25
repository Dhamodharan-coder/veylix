#!/usr/bin/env node
// Veylix CLI: pull Env Manager variables into apps, shells and CI pipelines.
// Zero dependencies; requires Node 18+ (global fetch).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";

const VERSION = "1.2.2";
const DEFAULT_URL = "https://veylix-omega.vercel.app";
const CONFIG_PATH = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "veylix", "config.json");
// Per-folder project/environment choice (no secrets, safe to commit).
const LINK_FILE = ".veylix.json";

const HELP = `veylix ${VERSION}: environment variables from Veylix

Usage:
  veylix login --token <vlx_…> [--url <server>]   Server defaults to ${DEFAULT_URL}
  veylix logout
  veylix whoami                       Show your account, token access and linked project
  veylix projects                     List projects and environments you can use
  veylix link [--project <name>] [--env <name>]
                                      Choose the project & environment for this folder
  veylix unlink                       Remove this folder's link
  veylix envs                         List environments of the project with variable counts
  veylix pull [--format dotenv|json|shell] [--output <file>]
  veylix run -- <command> [args…]     Run a command with the variables injected
  veylix push [--file .env] [--replace]
                                      Upload a .env file (read-write token)
  veylix set KEY=value [KEY2=value…]
  veylix unset KEY

  Every command accepts --project <name> and --env <name> to override the link.

Configuration (in order of priority):
  Token / server:  --token / --url  ›  VEYLIX_TOKEN / VEYLIX_URL  ›  ${CONFIG_PATH.replace(homedir(), "~")}
  Project / env:   --project / --env  ›  VEYLIX_PROJECT / VEYLIX_ENV  ›  ${LINK_FILE} (from \`veylix link\`)

Examples:
  veylix link                                   # pick interactively
  veylix pull > .env
  veylix run --env staging -- npm start
  veylix pull --project api --env production --format json
  VEYLIX_TOKEN=vlx_… VEYLIX_PROJECT=api VEYLIX_ENV=production veylix run -- node server.js   # CI

Create a token at ${DEFAULT_URL}/settings · Docs: ${DEFAULT_URL}/docs`;

// ---------- args ----------

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      rest = argv.slice(i + 1);
      break;
    }
    if (a.startsWith("--")) {
      const [key, inline] = a.slice(2).split(/=(.*)/s);
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[key] = argv[++i];
      else flags[key] = true;
    } else if (a === "-h") flags.help = true;
    else positional.push(a);
  }
  return { command: positional[0], args: positional.slice(1), flags, rest };
}

// ---------- config ----------

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  chmodSync(CONFIG_PATH, 0o600); // the token is a secret
}

function settings(flags) {
  const config = readConfig();
  const url = String(flags.url || process.env.VEYLIX_URL || config.url || DEFAULT_URL).replace(/\/$/, "");
  const token = flags.token || process.env.VEYLIX_TOKEN || config.token;
  if (!token) fail("Not logged in. Run `veylix login --token vlx_…` or set VEYLIX_TOKEN.");
  return { url, token: String(token) };
}

/** Nearest .veylix.json walking up from the current folder. */
function findLink() {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const file = join(dir, LINK_FILE);
    if (existsSync(file)) {
      try {
        return { file, ...JSON.parse(readFileSync(file, "utf8")) };
      } catch {
        fail(`Couldn't read ${file}. Run \`veylix link\` again.`);
      }
    }
    if (dirname(dir) === dir) return null;
  }
}

/** Project/environment for a command: flags › env vars › link file. Either may be undefined (the server picks when unambiguous). */
function target(flags) {
  const link = findLink();
  const chosen = flags.project || process.env.VEYLIX_PROJECT;
  // The link's environment only applies to the linked project.
  const sameProject = !chosen || chosen === link?.projectId || String(chosen).toLowerCase() === link?.project?.toLowerCase();
  const project = chosen || link?.projectId || link?.project;
  const env = flags.env || process.env.VEYLIX_ENV || (sameProject ? link?.env : undefined);
  return { project: project ? String(project) : undefined, env: env ? String(env) : undefined };
}

// ---------- http ----------

async function api(flags, path, init = {}) {
  const { url, token } = settings(flags);
  let res;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": `veylix-cli/${VERSION}`, ...init.headers },
    });
  } catch (e) {
    fail(`Can't reach Veylix at ${url} (${e.cause?.code || e.message})`);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {}
    fail(`${message} [HTTP ${res.status}]`);
  }
  return text;
}

function targetQuery(flags, extra = {}) {
  const { project, env } = target(flags);
  const q = new URLSearchParams(Object.entries({ ...extra, project, env }).filter(([, v]) => v));
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

const fetchSecrets = async (flags) => JSON.parse(await api(flags, `/api/v1/secrets${targetQuery(flags)}`));
const fetchMe = async (flags) => JSON.parse(await api(flags, "/api/v1/me"));

/** Asks the user to pick one of `items` (numbered list on stderr) by number or name. */
async function choose(question, items, label) {
  if (items.length === 1) return items[0];
  if (!process.stdin.isTTY) fail(`${question} Pass it as a flag (one of: ${items.map((item) => item.name).join(", ")}).`);
  info(c(1, question));
  items.forEach((item, i) => info(`  ${c(36, String(i + 1).padStart(2))}  ${label(item)}`));
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    for (;;) {
      const answer = (await rl.question(`Choose 1-${items.length}: `)).trim();
      const n = Number(answer);
      if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1];
      const byName = items.find((item) => item.name.toLowerCase() === answer.toLowerCase());
      if (byName) return byName;
    }
  } catch (e) {
    if (e.name === "AbortError") fail("Cancelled");
    throw e;
  } finally {
    rl.close();
  }
}

const where = (res) => `${res.project} › ${res.environment}`;

// ---------- formats ----------

const toDotenv = (secrets) => Object.entries(secrets).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n";
const toShell = (secrets) => Object.entries(secrets).map(([k, v]) => `export ${k}='${v.replace(/'/g, `'\\''`)}'`).join("\n") + "\n";

function parseDotenv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    const quoted = value.match(/^(['"])([\s\S]*)\1$/);
    if (quoted) {
      value = quoted[2];
      if (quoted[1] === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else value = value.replace(/\s+#.*$/, "");
    out[m[1]] = value;
  }
  return out;
}

// ---------- output ----------

const isTTY = process.stderr.isTTY;
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const info = (msg) => process.stderr.write(`${msg}\n`);
const success = (msg) => info(`${c(32, "✓")} ${msg}`);
function fail(msg) {
  process.stderr.write(`${c(31, "✗")} ${msg}\n`);
  process.exit(1);
}

// ---------- commands ----------

const commands = {
  async login(_, flags) {
    if (!flags.token || flags.token === true) fail("Usage: veylix login --token vlx_… [--url https://your-veylix]");
    const config = { url: String(flags.url || readConfig().url || DEFAULT_URL).replace(/\/$/, ""), token: String(flags.token) };
    const me = await fetchMe({ ...flags, ...config });
    writeConfig(config);
    const scope = me.scope === "all-projects" ? `all projects (${me.projects.length})` : `project ${c(1, me.projects[0]?.name)}`;
    success(`Logged in to ${config.url} as ${me.user?.email ?? "you"}: ${scope}, ${me.access}`);
    info(`Next: run ${c(1, "veylix link")} in your app's folder to choose a project and environment.`);
  },

  async logout() {
    if (existsSync(CONFIG_PATH)) writeConfig({ url: readConfig().url });
    success("Logged out");
  },

  async whoami(_, flags) {
    const me = await fetchMe(flags);
    const link = findLink();
    const t = target(flags);
    const project = me.projects.find((p) => p.id === t.project || p.name.toLowerCase() === t.project?.toLowerCase());
    console.log(`Account:  ${me.user ? `${me.user.name} <${me.user.email}>` : "-"}`);
    console.log(`Server:   ${settings(flags).url}`);
    console.log(`Token:    ${me.scope === "all-projects" ? "all projects" : me.projects[0]?.name}, ${me.access}`);
    console.log(`Using:    ${project ? `${project.name} › ${t.env ?? "(no environment)"}` : "nothing linked; run `veylix link`"}`);
    if (link) console.log(`Linked:   ${relative(process.cwd(), link.file) || LINK_FILE}`);
  },

  async projects(_, flags) {
    const me = await fetchMe(flags);
    if (!me.projects.length) return info("No projects yet. Create one in Veylix first.");
    const t = target(flags);
    let marked = false;
    const width = Math.max(...me.projects.map((p) => p.name.length), 7);
    console.log(`${"PROJECT".padEnd(width)}  ENVIRONMENTS (variables)`);
    for (const p of me.projects) {
      const linked = p.id === t.project || p.name.toLowerCase() === t.project?.toLowerCase();
      marked ||= linked;
      const envs = p.environments.map((e) => `${linked && e.name === t.env ? c(32, `${e.name}*`) : e.name} (${e.variables})`).join(", ");
      console.log(`${(linked ? c(32, p.name) : p.name) + " ".repeat(width - p.name.length)}  ${envs || c(2, "no environments")}`);
    }
    if (marked && t.env) info(c(2, "\n* currently used in this folder"));
  },

  async link(_, flags) {
    const me = await fetchMe(flags);
    if (!me.projects.length) fail("No projects yet. Create one in Veylix first.");
    let project;
    if (flags.project) {
      const ref = String(flags.project).toLowerCase();
      project = me.projects.find((p) => p.id === flags.project || p.name.toLowerCase() === ref);
      if (!project) fail(`Project "${flags.project}" not found. Available: ${me.projects.map((p) => p.name).join(", ")}`);
    } else project = await choose("Which project?", me.projects, (p) => `${p.name} ${c(2, `(${p.environments.length} environment${p.environments.length === 1 ? "" : "s"})`)}`);

    if (!project.environments.length) fail(`${project.name} has no environments yet.`);
    let env;
    if (flags.env) {
      env = project.environments.find((e) => e.name === String(flags.env).toLowerCase());
      if (!env) fail(`Environment "${flags.env}" not found in ${project.name}. Available: ${project.environments.map((e) => e.name).join(", ")}`);
    } else env = await choose(`Which environment of ${project.name}?`, project.environments, (e) => `${e.name} ${c(2, `(${e.variables} variable${e.variables === 1 ? "" : "s"})`)}`);

    writeFileSync(LINK_FILE, JSON.stringify({ projectId: project.id, project: project.name, env: env.name }, null, 2) + "\n");
    success(`Linked this folder to ${c(1, `${project.name} › ${env.name}`)} (${LINK_FILE})`);
    info(c(2, "Now try: veylix pull > .env   or   veylix run -- npm start"));
  },

  async unlink() {
    const link = findLink();
    if (!link) return info("This folder isn't linked.");
    rmSync(link.file);
    success(`Removed ${relative(process.cwd(), link.file) || LINK_FILE}`);
  },

  async envs(_, flags) {
    const me = await fetchMe(flags);
    const t = target(flags);
    const project = t.project
      ? me.projects.find((p) => p.id === t.project || p.name.toLowerCase() === t.project.toLowerCase())
      : me.projects.length === 1 ? me.projects[0] : null;
    if (!project) fail(t.project ? `Project "${t.project}" not found.` : "Which project? Run `veylix link` or pass --project <name>.");
    const width = Math.max(...project.environments.map((e) => e.name.length), 11);
    info(c(2, project.name));
    console.log(`${"ENVIRONMENT".padEnd(width)}  VARIABLES`);
    for (const e of project.environments) console.log(`${e.name.padEnd(width)}  ${e.variables}`);
  },

  async pull(_, flags) {
    const res = await fetchSecrets(flags);
    const { secrets } = res;
    const format = flags.format || "dotenv";
    const body = format === "json" ? JSON.stringify(secrets, null, 2) + "\n" : format === "shell" ? toShell(secrets) : toDotenv(secrets);
    if (flags.output) {
      writeFileSync(String(flags.output), body, { mode: 0o600 });
      success(`Wrote ${Object.keys(secrets).length} variables from ${where(res)} to ${flags.output}`);
    } else process.stdout.write(body);
  },

  async run(_, flags, rest) {
    if (!rest.length) fail("Usage: veylix run [--project <name>] [--env <name>] -- <command> [args…]");
    const res = await fetchSecrets(flags);
    const { secrets } = res;
    info(c(2, `veylix: injecting ${Object.keys(secrets).length} variables from ${where(res)}`));
    const child = spawn(rest[0], rest.slice(1), { stdio: "inherit", env: { ...process.env, ...secrets }, shell: process.platform === "win32" });
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
    child.on("error", (e) => fail(`Couldn't start ${rest[0]}: ${e.message}`));
    child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
  },

  async push(_, flags) {
    const file = String(flags.file || ".env");
    if (!existsSync(file)) fail(`File not found: ${file}`);
    const secrets = parseDotenv(readFileSync(file, "utf8"));
    if (!Object.keys(secrets).length) fail(`No KEY=value lines found in ${file}`);
    const res = JSON.parse(await api(flags, "/api/v1/secrets", { method: "PUT", body: JSON.stringify({ ...target(flags), secrets, replace: !!flags.replace }) }));
    success(`${where(res)}: ${res.created} created, ${res.updated} updated${res.deleted ? `, ${res.deleted} deleted` : ""}`);
  },

  async set(args, flags) {
    const pairs = args.map((a) => a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s));
    if (!pairs.length || pairs.some((p) => !p)) fail("Usage: veylix set KEY=value [KEY2=value…]");
    const secrets = Object.fromEntries(pairs.map((p) => [p[1], p[2]]));
    const res = JSON.parse(await api(flags, "/api/v1/secrets", { method: "PUT", body: JSON.stringify({ ...target(flags), secrets }) }));
    success(`${where(res)}: ${res.created} created, ${res.updated} updated`);
  },

  async unset(args, flags) {
    if (!args[0]) fail("Usage: veylix unset KEY");
    const res = JSON.parse(await api(flags, `/api/v1/secrets${targetQuery(flags, { key: args[0] })}`, { method: "DELETE" }));
    success(`Deleted ${res.deleted} from ${where(res)}`);
  },
};

// ---------- main ----------

const { command, args, flags, rest } = parseArgs(process.argv.slice(2));
if (flags.version || command === "version") console.log(VERSION);
else if (!command || flags.help || command === "help") console.log(HELP);
else if (!commands[command]) fail(`Unknown command "${command}". Run \`veylix help\`.`);
else await commands[command](args, flags, rest);
