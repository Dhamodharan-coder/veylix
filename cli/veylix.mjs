#!/usr/bin/env node
// Veylix CLI: pull Env Manager variables into apps, shells and CI pipelines.
// Zero dependencies; requires Node 18+ (global fetch).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const VERSION = "1.0.0";
const CONFIG_PATH = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "veylix", "config.json");

const HELP = `veylix ${VERSION}: environment variables from Veylix

Usage:
  veylix login --token <vlx_…> [--url <https://your-veylix>]
  veylix logout
  veylix whoami                       Show the project and access of your token
  veylix envs                         List environments and variable counts
  veylix pull [--env <name>] [--format dotenv|json|shell] [--output <file>]
  veylix run [--env <name>] -- <command> [args…]
                                      Run a command with the variables injected
  veylix push [--env <name>] [--file .env] [--replace]
                                      Upload a .env file (read-write token)
  veylix set KEY=value [KEY2=value…] [--env <name>]
  veylix unset KEY [--env <name>]

Configuration (in order of priority):
  --token / --url flags  ›  VEYLIX_TOKEN / VEYLIX_URL env vars  ›  ${CONFIG_PATH.replace(homedir(), "~")}
  VEYLIX_ENV sets the default environment.

Examples:
  veylix pull --env production > .env
  veylix run --env staging -- npm start
  VEYLIX_TOKEN=vlx_… veylix run --env production -- node server.js   # CI`;

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
  const url = String(flags.url || process.env.VEYLIX_URL || config.url || "http://localhost:3000").replace(/\/$/, "");
  const token = flags.token || process.env.VEYLIX_TOKEN || config.token;
  if (!token) fail("Not logged in. Run `veylix login --token vlx_…` or set VEYLIX_TOKEN.");
  return { url, token: String(token) };
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

const envQuery = (flags) => {
  const env = flags.env || process.env.VEYLIX_ENV;
  return env ? `env=${encodeURIComponent(env)}` : "";
};

async function fetchSecrets(flags) {
  const q = envQuery(flags);
  return JSON.parse(await api(flags, `/api/v1/secrets${q ? `?${q}` : ""}`));
}

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
    const config = { url: String(flags.url || readConfig().url || "http://localhost:3000").replace(/\/$/, ""), token: String(flags.token) };
    const me = JSON.parse(await api({ ...flags, ...config }, "/api/v1/me"));
    writeConfig(config);
    success(`Logged in to ${config.url}. Project ${c(1, me.project.name)} (${me.access})`);
  },

  async logout() {
    if (existsSync(CONFIG_PATH)) writeConfig({ url: readConfig().url });
    success("Logged out");
  },

  async whoami(_, flags) {
    const me = JSON.parse(await api(flags, "/api/v1/me"));
    console.log(`Project:      ${me.project.name}`);
    console.log(`Access:       ${me.access}`);
    console.log(`Environments: ${me.environments.map((e) => e.name).join(", ")}`);
    console.log(`Server:       ${settings(flags).url}`);
  },

  async envs(_, flags) {
    const me = JSON.parse(await api(flags, "/api/v1/me"));
    const width = Math.max(...me.environments.map((e) => e.name.length), 11);
    console.log(`${"ENVIRONMENT".padEnd(width)}  VARIABLES`);
    for (const e of me.environments) console.log(`${e.name.padEnd(width)}  ${e.variables}`);
  },

  async pull(_, flags) {
    const { environment, secrets } = await fetchSecrets(flags);
    const format = flags.format || "dotenv";
    const body = format === "json" ? JSON.stringify(secrets, null, 2) + "\n" : format === "shell" ? toShell(secrets) : toDotenv(secrets);
    if (flags.output) {
      writeFileSync(String(flags.output), body, { mode: 0o600 });
      success(`Wrote ${Object.keys(secrets).length} variables from ${environment} to ${flags.output}`);
    } else process.stdout.write(body);
  },

  async run(_, flags, rest) {
    if (!rest.length) fail("Usage: veylix run [--env <name>] -- <command> [args…]");
    const { environment, secrets } = await fetchSecrets(flags);
    info(c(2, `veylix: injecting ${Object.keys(secrets).length} variables from ${environment}`));
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
    const res = JSON.parse(await api(flags, "/api/v1/secrets", { method: "PUT", body: JSON.stringify({ env: flags.env || process.env.VEYLIX_ENV, secrets, replace: !!flags.replace }) }));
    success(`${res.environment}: ${res.created} created, ${res.updated} updated${res.deleted ? `, ${res.deleted} deleted` : ""}`);
  },

  async set(args, flags) {
    const pairs = args.map((a) => a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s));
    if (!pairs.length || pairs.some((p) => !p)) fail("Usage: veylix set KEY=value [KEY2=value…] [--env <name>]");
    const secrets = Object.fromEntries(pairs.map((p) => [p[1], p[2]]));
    const res = JSON.parse(await api(flags, "/api/v1/secrets", { method: "PUT", body: JSON.stringify({ env: flags.env || process.env.VEYLIX_ENV, secrets }) }));
    success(`${res.environment}: ${res.created} created, ${res.updated} updated`);
  },

  async unset(args, flags) {
    if (!args[0]) fail("Usage: veylix unset KEY [--env <name>]");
    const q = envQuery(flags);
    const res = JSON.parse(await api(flags, `/api/v1/secrets?key=${encodeURIComponent(args[0])}${q ? `&${q}` : ""}`, { method: "DELETE" }));
    success(`Deleted ${res.deleted} from ${res.environment}`);
  },
};

// ---------- main ----------

const { command, args, flags, rest } = parseArgs(process.argv.slice(2));
if (flags.version || command === "version") console.log(VERSION);
else if (!command || flags.help || command === "help") console.log(HELP);
else if (!commands[command]) fail(`Unknown command "${command}". Run \`veylix help\`.`);
else await commands[command](args, flags, rest);
