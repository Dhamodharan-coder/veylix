# veylix-cli

[![npm version](https://img.shields.io/npm/v/veylix-cli.svg)](https://www.npmjs.com/package/veylix-cli)
[![node](https://img.shields.io/node/v/veylix-cli.svg)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/veylix-cli?activeTab=dependencies)
[![license](https://img.shields.io/npm/l/veylix-cli.svg)](./LICENSE)

The official command-line tool for **[Veylix](https://veylix-omega.vercel.app)**. It pulls your environment variables into local development, shell sessions and CI/CD pipelines, so you don't have to copy `.env` files around.

```bash
npm install -g veylix-cli
veylix login --token vlx_…
veylix link
veylix run -- npm run dev
```

- **No `.env` files on disk.** `veylix run` puts variables straight into your process.
- **One token for every project.** Choose the project and environment per folder.
- **CI-ready.** Configure everything through environment variables, with no interactive prompts.
- **Zero dependencies.** A single ESM file on Node 18+, so it installs in about a second and is easy to audit.
- **Secure defaults.** The config file is written with `0600` permissions, and secrets go to stdout only when you ask for them.

---

## Installation

```bash
npm install -g veylix-cli      # or: pnpm add -g veylix-cli / yarn global add veylix-cli
veylix --version
```

To run it once without installing:

```bash
npx veylix-cli pull
```

Requires **Node.js 18 or newer**.

## Quick start

**1. Create an API token.** Sign in at **[veylix-omega.vercel.app](https://veylix-omega.vercel.app)** and go to **Settings → API tokens**. A token can cover all your projects or only one, can be read-only or read-write, and can expire.

**2. Log in.**

```bash
veylix login --token vlx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```
✓ Logged in to https://veylix-omega.vercel.app as you@company.com: all projects (3), read-write
```

**3. Link a folder to a project and environment.**

```bash
cd my-app
veylix link
```

```
Which project?
   1  api        (3 environments)
   2  web        (2 environments)
Choose 1-2: 1
Which environment of api?
   1  development (12 variables)
   2  staging     (14 variables)
   3  production  (14 variables)
Choose 1-3: 1
✓ Linked this folder to api › development (.veylix.json)
```

**4. Use your variables.**

```bash
veylix run -- npm run dev       # inject into a process
veylix pull > .env              # or write a .env file
```

## Commands

| Command | Description |
|---|---|
| `veylix login --token <vlx_…> [--url <server>]` | Save your token (and server) after checking it with the API |
| `veylix logout` | Remove the saved token |
| `veylix whoami` | Show the account, token scope, server and linked project |
| `veylix projects` | List projects, environments and variable counts |
| `veylix link [--project <name>] [--env <name>]` | Link the current folder (writes `.veylix.json`) |
| `veylix unlink` | Remove the folder link |
| `veylix envs` | List the environments of the current project |
| `veylix pull [--format dotenv\|json\|shell] [--output <file>]` | Print or save variables |
| `veylix run -- <command> [args…]` | Run a command with the variables injected |
| `veylix push [--file .env] [--replace]` | Upload a `.env` file (needs a read-write token) |
| `veylix set KEY=value [KEY2=value…]` | Create or update variables |
| `veylix unset KEY` | Delete a variable |
| `veylix help` / `veylix --version` | Show help or the version |

Every command accepts `--project <name|id>` and `--env <name>` to override the folder link.

### Examples

```bash
# Run against another environment for a single command
veylix run --env staging -- npm start

# Export as JSON for tooling
veylix pull --project api --env production --format json

# Load into the current shell session
eval "$(veylix pull --format shell)"

# Write a file with 0600 permissions
veylix pull --output .env.local

# Sync a local .env up to Veylix; --replace also deletes keys missing from the file
veylix push --file .env.production --env production --replace

# Quick edits
veylix set STRIPE_KEY=sk_live_… FEATURE_FLAG=true
veylix unset LEGACY_API_URL
```

## Configuration

Settings are resolved in this order (first match wins):

| Setting | 1. Flag | 2. Environment variable | 3. Saved |
|---|---|---|---|
| Token | `--token` | `VEYLIX_TOKEN` | `~/.config/veylix/config.json` |
| Server URL | `--url` | `VEYLIX_URL` | `~/.config/veylix/config.json`, then `https://veylix-omega.vercel.app` |
| Project | `--project` | `VEYLIX_PROJECT` | nearest `.veylix.json` |
| Environment | `--env` | `VEYLIX_ENV` | nearest `.veylix.json` |

- **`~/.config/veylix/config.json`** holds your token. It is created with mode `0600` and respects `XDG_CONFIG_HOME`.
- **`.veylix.json`** holds only the project and environment names, never secrets. **Commit it**, so everyone on the team pulls the same environment. The CLI looks for it in the current folder and every parent folder, so it works in monorepos.
- You can leave out the project or environment when it's unambiguous, for example when the token can reach only one project.

### Self-hosted Veylix

```bash
veylix login --url https://veylix.your-company.com --token vlx_…
```

## CI/CD

The CLI needs no login step in CI. Pass everything as environment variables:

```bash
VEYLIX_TOKEN=vlx_… VEYLIX_PROJECT=api VEYLIX_ENV=production \
  npx veylix-cli run -- node server.js
```

<details>
<summary><b>GitHub Actions</b></summary>

```yaml
- name: Deploy
  env:
    VEYLIX_TOKEN: ${{ secrets.VEYLIX_TOKEN }}
    VEYLIX_PROJECT: api
    VEYLIX_ENV: production
  run: npx veylix-cli run -- npm run deploy
```

</details>

<details>
<summary><b>GitLab CI</b></summary>

```yaml
deploy:
  image: node:20
  variables:
    VEYLIX_PROJECT: api
    VEYLIX_ENV: production
  script:
    - npx veylix-cli run -- npm run deploy   # VEYLIX_TOKEN set as a masked CI/CD variable
```

</details>

<details>
<summary><b>Docker</b></summary>

```bash
veylix pull --env production --output .env.production
docker run --env-file .env.production my-image
```

</details>

For CI, use a **read-only token scoped to one project**, and set an expiry.

## Security

- Tokens are sent only to your Veylix server, in the `Authorization` header (HTTPS on the hosted service).
- The server looks tokens up by SHA-256 hash and keeps them encrypted at rest. You can revoke, regenerate and expire them in **Settings → API tokens**.
- `veylix run` keeps secrets in the child process's memory only. Nothing is written to disk.
- `pull --output` creates files with mode `0600`. Add `.env*` to your `.gitignore`.
- Read-only tokens can't change anything, even if they leak.

## Troubleshooting

| Message | Fix |
|---|---|
| `Not logged in` | Run `veylix login --token …` or set `VEYLIX_TOKEN` |
| `Can't reach Veylix at …` | Check `--url` / `VEYLIX_URL` and your network |
| `Which project? Pass it as a flag` | Run `veylix link`, or pass `--project` / set `VEYLIX_PROJECT` in CI |
| `[HTTP 401]` | The token is invalid, revoked or expired. Create a new one |
| `[HTTP 403]` | The token is read-only. Use a read-write token for `push`, `set` and `unset` |
| `[HTTP 404]` | The project or environment doesn't exist or isn't covered by the token. Run `veylix projects` |
| `[HTTP 429]` | Rate limited. Wait a moment and retry |

## License

[MIT](./LICENSE) © Veylix
