# CLAUDE.md

Guidance for working in this repository (for Claude Code and human contributors).

## Project
**Veylix** is one Next.js app with two **strictly separate** modules, switched via the app switcher at the top of the sidebar:

| Module | Routes | Tables | Encryption |
|---|---|---|---|
| **Env Manager** | `/dashboard`, `/projects/[projectId]` | `project`, `environment`, `secret` | Server-side AES-256-GCM with `ENCRYPTION_KEY` (`src/lib/crypto.ts`) |
| **Vault** (Zoho Vault–style password manager) | `/vault/*` | `vault_*` | **Zero-knowledge**: encrypted in the browser (`src/lib/vault-crypto.ts`) |

Never mix the two: no shared tables, actions or components beyond the app shell.

## Stack
Next.js 16 (App Router, Turbopack, `cacheComponents`), React 19, TypeScript, Tailwind CSS v4, **shadcn/ui** (radix-nova, `src/components/ui`), Prisma 7 + `@prisma/adapter-pg` on Neon Postgres, Better Auth, next-themes, sonner, zod, lucide-react.

## Commands
```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # prisma generate + next build (standalone output)
npm run lint         # eslint
npx tsc --noEmit     # type-check
npm run db:migrate   # prisma migrate dev (creates + applies a migration)
npm run db:deploy    # prisma migrate deploy (apply pending migrations)
npm run db:studio    # browse the database
docker compose up --build   # run migrations + production container on :3000
```

## Layout
```
prisma/schema.prisma            all models (Better Auth, Env, Vault)
src/proxy.ts                    optimistic auth redirect (Next 16 "proxy" = old middleware)
src/app/(auth)/                 sign-in, sign-up, verify-email, forgot/reset password
src/app/(app)/layout.tsx        app shell: shadcn Sidebar, AppSwitcher, VaultProvider
src/app/(app)/dashboard|projects|settings   Env Manager + account settings
src/app/(app)/vault/            Vault pages + actions.ts (all vault server actions)
src/app/actions.ts              Env Manager server actions
src/lib/                        auth, db, session, email, crypto, projects, vault-*
src/components/ui/              shadcn components (generated; edit freely)
src/components/vault/           Vault client components
src/components/*                shared app components (page helpers, skeletons, confirm, toast…)
src/generated/prisma/           generated Prisma client (git-ignored)
```

## Conventions
- **UI:** use shadcn components only. Cards use the soft ring/shadow look (no heavy borders). Destructive actions are **red**: Button variants `danger` (solid) and `destructive-ghost` (icon/text).
- **Confirmations:** `useConfirm()` from `src/components/confirm-dialog.tsx` (shadcn AlertDialog). Never `window.confirm`/`prompt`. Use `requireText` for irreversible deletes.
- **Alerts:** `notify.success/error/info/warning` from `src/components/toast.tsx`.
- **Loading:** skeletons from `src/components/skeletons.tsx`, never "Loading…" text.
- **Page structure:** `PageHeader`, `EmptyState`, `Field`, `UserAvatar`, `formatDate` from `src/components/page.tsx`. `IconButton` adds a tooltip to icon-only buttons.
- **cacheComponents:** anything reading the session, `headers()`, `searchParams` or request-time env must sit inside `<Suspense>`. Pages that depend on runtime env call `await connection()` first (see `src/app/(auth)/*/page.tsx`) so a single Docker image works in any environment.
- **Mutations:** Server Actions call `refresh()` from `next/cache` after writes. Return `{ error }` / `{ ok }` objects instead of throwing for expected failures.
- **Authorization:** every Env action resolves the user (`requireUser`) and scopes queries by owner. Every Vault action goes through `requireFolderPermission` / `requireItemPermission` (`src/lib/vault-access.ts`) and logs via `logVaultEvent` (`src/lib/vault-audit.ts`).
- **Rate limiting:** Better Auth's limiter (`rateLimit` in `src/lib/auth.ts`, per IP, strict rules for sign-in/sign-up/reset/verification) plus `enforce(name, userId)` from `src/lib/rate-limit.ts` in sensitive server actions and the extension API (limits defined in `LIMITS`). Both store counters in the `rate_limit` table so they hold across serverless instances. `RATE_LIMIT_ENABLED="false"` disables both. Vault actions get the error via `run()`, Env form actions via `limited()`.

## Vault security model (don't weaken)
- Master password → PBKDF2-SHA256 (600k) → HKDF → AES-GCM wrapping key → unwraps the user's RSA-OAEP-2048 private key. The **master password is never stored or sent**, not even as a hash. A wrong password fails AES-GCM decryption.
- Folder key (AES) is sealed per member with their public key. Each item key (AES) is wrapped by the folder key, and sealed to recipients for direct item shares.
- Ciphertext formats: `v1.<iv>.<ct>` (AES-GCM), `r1.<ct>` (RSA). Server actions validate these formats.
- Plaintext metadata by design: folder names, item name/URL/tags (search + audit). Username/password/notes are encrypted.
- Keys live only in memory (`VaultProvider`). Reload or auto-lock clears them. Never add server-side decryption of vault data.
- Sharing with someone who has no vault yet creates a pending row/invite. A manager's browser grants the key after unlock (`grantPending`). Removing a folder member offers key rotation (`rotateFolderKey`).
- Recovery: setup creates a recovery key (160-bit, Crockford base32, `generateRecoveryKey`) that seals a second copy of the private key (`recoveryWrappedPrivateKey`). "Forgot master password?" → recovery key → new master password + rotated recovery key (`recoverVault`); without one, `resetVault` (login password or email confirmation) deletes owned vault data and resets shared access to "awaiting" so sharers re-grant it.
- Known limits: View access can still reveal passwords; single-item revoke doesn't rotate the key (UI suggests changing the password); a vault with no recovery key can only be reset, not recovered.

## Browser extension (`extension/`)
- Manifest V3 (Chromium). Sources in `extension/src` (`background.ts` service worker, `popup.ts`, `content.ts`, `shared.ts`). Built with esbuild by `scripts/build-extension.mjs` into `extension/dist` (git-ignored, load unpacked). Commands: `npm run build:extension`, `npm run dev:extension`, `npm run typecheck:extension`.
- It **reuses `src/lib/vault-crypto.ts`** (bundled in), so keep that module free of Node/Next imports.
- Auth: the background reads the Better Auth session cookie via `chrome.cookies` and sends it as `Authorization: Bearer <signed token>`. The `bearer({ requireSignature: true })` plugin in `src/lib/auth.ts` accepts it.
- API: `GET /api/extension/vault` (account + ciphertext snapshot) and `POST /api/extension/log` (audit; rejects non-extension origins). Both are in `src/app/api/extension/`.
- Unlocked state = PKCS#8 private key in `chrome.storage.session` (memory-only, not readable by content scripts), cleared by an `alarms` auto-lock.
- Biometric unlock (Touch ID / Windows Hello) uses the **WebAuthn PRF** extension (`extension/src/biometric.ts`): the PRF output → HKDF → AES key encrypts the PKCS#8 key into `chrome.storage.local` (`biometric`), bound to the server URL + vault public key. Without a fingerprint it can't be decrypted. WebAuthn ceremonies run in a standalone extension window (`popup.html?window=1`), because the OS prompt would close the toolbar popup.
- Clicking the in-page icon while locked opens the popup (`chrome.action.openPopup`, falling back to the window). Never collect the master password inside a web page.
- The content script only ever receives names/usernames for matching logins. Passwords are injected by the background via `chrome.scripting.executeScript` (`fillCredentials` uses the native value setter so React/Angular inputs update). `fillHere` refuses to fill a login on a non-matching domain.

## Database workflow
- Migrations live in `prisma/migrations`. Create with `npx prisma migrate dev --create-only --name <name>`, review the SQL, then apply with `npx prisma migrate deploy`.
- `prisma.config.ts` uses `DIRECT_URL` (Neon **non-pooled**) for migrations. Running migrations through the `-pooler` URL can leave a stuck advisory lock (error `P1002`).
- After schema changes run `npx prisma generate`. `src/lib/db.ts` replaces a stale cached client automatically in dev.

## Environment variables
See `.env.example`. Key ones: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ENCRYPTION_KEY` (Env Manager only, never rotate after use), `EMAIL_ENABLED` (`false` = no emails, no verification, no forgot-password), `EMAIL_FROM` + SMTP (`SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASS` or `SMTP_URL`, via Nodemailer) or `RESEND_API_KEY` (provider auto-detected in `src/lib/email.ts`; verify with `npm run email:test -- you@x.com`), optional `GITHUB_*`/`GOOGLE_*` OAuth. Email sending is centralized in `sendMail` (`src/lib/email.ts`), the single place to plug in a mail service.

## Docker
- `Dockerfile` stages: `deps` → `builder` (standalone build with placeholder env) → `runner` (non-root, ~300 MB, healthcheck) and `migrate` (runs `prisma migrate deploy`).
- `docker-compose.yml` runs `migrate` then `app`, both reading `.env`. Secrets are never copied into images (`.dockerignore`).

## Branding
- The logo has one source: `brand/logo.png` (or `brand/logo.svg` as a fallback). `npm run brand` (`scripts/brand.mjs`, uses sharp) generates `src/app/icon.png`, `src/app/apple-icon.png`, `public/logo.png` (used by `LogoMark`) and `brand/extension/icon-*.png` (copied by the extension build). Commit the generated files.

## Gotchas
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before using unfamiliar APIs (e.g. `proxy.ts`, async request APIs, `refresh()`).
- If the dev server shows stale styles or 404s for new routes, restart it with a clean cache: `rm -rf .next && npm run dev`.
- Don't run `next build` in the project folder while `next dev` is running (it corrupts the dev cache). Build in a copy or use Docker.
- `agentRules: false` in `next.config.ts` stops `next dev` from generating an `AGENTS.md`.
