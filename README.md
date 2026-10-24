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
| `EMAIL_FROM` | Sender, e.g. `Veylix <no-reply@yourdomain.com>`. Must be an address your provider allows you to send from |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Any SMTP provider via Nodemailer (see the Email section). Or set `SMTP_URL` instead |
| `RESEND_API_KEY` | Alternative to SMTP: resend.com API key |
| `GITHUB_CLIENT_*` | github.com/settings/developers → New OAuth App. Callback: `<BETTER_AUTH_URL>/api/auth/callback/github` |
| `GOOGLE_CLIENT_*` | console.cloud.google.com → Credentials → OAuth client. Redirect: `<BETTER_AUTH_URL>/api/auth/callback/google` |

## Browser extension (autofill)

The **Veylix extension** (Chrome, Brave, Edge) fills saved logins on websites, like the Zoho Vault extension.

```bash
npm run build:extension      # builds extension/dist (use dev:extension to rebuild on change)
```

1. Open `brave://extensions` (or `chrome://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `extension/dist` folder.
3. Pin the Veylix icon, sign in to Veylix in the browser, then click the icon and **unlock** with your master password.

On a login page you'll see a Veylix icon in the username field. Click it to pick a saved login and fill it. The toolbar popup lists logins for the current site with **Fill**, **Copy username/password** and **Open & fill**.

Your master password and decrypted passwords never leave the extension. It only downloads ciphertext from `/api/extension/vault`, authenticated with your Veylix session. The unlocked key lives in the browser's in-memory session storage and auto-locks after your vault's timeout. If Veylix isn't on `http://localhost:3000`, set the URL with the ⚙️ in the popup.

## Email

Veylix sends verification and password-reset emails through **any SMTP provider** (via Nodemailer) or Resend, configured entirely in `.env`:

```bash
EMAIL_ENABLED="true"
EMAIL_FROM="Veylix <no-reply@yourdomain.com>"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="you@gmail.com"
SMTP_PASS="your-app-password"
```

| Provider | `SMTP_HOST` | Port | Notes |
|---|---|---|---|
| Gmail | `smtp.gmail.com` | 587 | Needs 2-Step Verification + an **App password** (~500 emails/day) |
| Outlook / Microsoft 365 | `smtp.office365.com` | 587 | SMTP AUTH must be enabled for the mailbox |
| Zoho Mail | `smtp.zoho.com` (`smtp.zoho.in` for India) | 465 (`SMTP_SECURE="true"`) | Use an app-specific password |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 | SMTP credentials from the SES console |
| Brevo | `smtp-relay.brevo.com` | 587 | Free tier: 300 emails/day |
| Resend (SMTP) | `smtp.resend.com` | 465 | User `resend`, password = API key |

The provider is picked automatically (SMTP if `SMTP_HOST`/`SMTP_URL` is set, otherwise Resend if `RESEND_API_KEY` is set, otherwise links are printed to the terminal). Check your settings before relying on them:

```bash
npm run email:test -- you@example.com
```

## Logo

Replace `brand/logo.png` (square, 1024×1024, transparent background), then run `npm run brand`. It regenerates the browser tab icon, the Apple icon, the in-app logo and the extension icons.

## Docker

```bash
cp .env.example .env   # fill in your values (same as local setup)
docker compose up --build
```

This builds a small production image (Next.js standalone, non-root, with a healthcheck), runs `prisma migrate deploy` as a one-off `migrate` container, then starts the app on http://localhost:3000. Configuration is read from `.env` at runtime. No secrets are baked into the image.

Useful commands:

```bash
docker compose up -d --build      # run in the background
docker compose logs -f app        # follow app logs
docker compose run --rm migrate   # apply new migrations
docker compose down               # stop
```

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
