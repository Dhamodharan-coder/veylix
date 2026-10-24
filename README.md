# Veylix

Veylix — an env manager and zero-knowledge password vault, built with **Next.js 16**, **Prisma 7 + Neon Postgres**, and **Better Auth**.

Two separate modules, switched from the top of the sidebar:

**Env Manager** (`/dashboard`, `/projects`)
- Projects → environments (development / staging / production) → variables
- Values encrypted server-side with **AES-256-GCM** (`ENCRYPTION_KEY`)
- Import a pasted `.env`, download any environment as `.env`

**Vault** (`/vault`): a Zoho Vault–style password manager
- Unlocked with a **master password** (separate from the login password, never stored or sent)
- **Zero-knowledge**: logins and notes are encrypted in the browser (WebCrypto). Master password → PBKDF2 (600k) → HKDF → wraps the user's RSA-OAEP private key; folder and item keys are AES-256-GCM
- Folders, favorites, tags, password generator and strength meter
- Share a folder or a single password with **View / Modify / Manage** permissions; people who haven't set up a vault yet get access automatically once they do
- Key rotation after removing someone, an audit log, and security reports (weak, reused, old passwords and access overview)
- Auto-lock after inactivity; reloading the page locks the vault
- ⚠️ A forgotten master password can't be recovered

**Accounts**
- Email + password sign-up (email verification when `EMAIL_ENABLED="true"`)
- Optional **GitHub / Google OAuth** (buttons appear when keys are set)

## Local setup

```bash
npm install
cp .env.example .env    # then fill it in (see below)
npm run db:migrate      # creates the tables in Neon
npm run dev             # http://localhost:3000
```

### `.env` values

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → **Connect** → *Connection pooling ON* (host contains `-pooler`) |
| `DIRECT_URL` | Same dialog with pooling **OFF** (used only for migrations) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally, your real URL in production |
| `ENCRYPTION_KEY` | `openssl rand -base64 32`. **Never change it** once secrets are stored, or they can't be decrypted |
| `EMAIL_ENABLED` | `false` (default): no emails, sign-up logs straight in, reset links print in the terminal. `true`: emails sent and verification required |
| `RESEND_API_KEY` | resend.com → API Keys. Leave empty in dev: email links are printed in the terminal |
| `EMAIL_FROM` | `onboarding@resend.dev` works for testing (only delivers to your own Resend account email). Verify a domain to email anyone |
| `GITHUB_CLIENT_*` | github.com/settings/developers → New OAuth App. Callback: `<BETTER_AUTH_URL>/api/auth/callback/github` |
| `GOOGLE_CLIENT_*` | console.cloud.google.com → Credentials → OAuth client. Redirect: `<BETTER_AUTH_URL>/api/auth/callback/google` |

## Deploy (Vercel + Neon, free)

1. Push this folder to a GitHub repository.
2. vercel.com → **Add New Project** → import the repo (Next.js is auto-detected).
3. Add every variable from `.env` in **Settings → Environment Variables**, with `BETTER_AUTH_URL` set to your `https://<app>.vercel.app` URL.
4. Deploy. Every later `git push` redeploys automatically.
5. When the schema changes: `npm run db:migrate` locally (creates a migration), commit it, then run `npm run db:deploy` against production.

Remember to add the production callback URLs to your GitHub/Google OAuth apps.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run db:migrate` | Create & apply a migration (dev) |
| `npm run db:deploy` | Apply pending migrations (prod) |
| `npm run db:studio` | Browse the database in the browser |
