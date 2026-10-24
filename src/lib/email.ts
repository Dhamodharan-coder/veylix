import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

/**
 * Master switch for all outgoing email (verification, password reset).
 * Off by default: no mail is sent, email verification is not required,
 * and links are printed to the server terminal instead.
 */
export const emailEnabled = process.env.EMAIL_ENABLED === "true";

/**
 * Provider is chosen from env, with no code changes needed:
 *   SMTP_URL or SMTP_HOST set → SMTP via Nodemailer (Gmail, Outlook, Zoho, SES, Brevo, …)
 *   RESEND_API_KEY set        → Resend API
 *   neither                   → log links to the server console
 * EMAIL_PROVIDER=smtp|resend|console forces one explicitly.
 */
type Provider = "smtp" | "resend" | "console";

function detectProvider(): Provider {
  if (!emailEnabled) return "console";
  const forced = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (forced === "smtp" || forced === "resend" || forced === "console") return forced;
  if (process.env.SMTP_URL || process.env.SMTP_HOST) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "console";
}

export const emailProvider = detectProvider();

if (emailEnabled && emailProvider === "console") {
  console.warn("[email] EMAIL_ENABLED=true but no SMTP_HOST/SMTP_URL or RESEND_API_KEY is set. Emails will only be logged.");
}

const FROM = process.env.EMAIL_FROM ?? "Veylix <no-reply@veylix.local>";

// One pooled SMTP connection per server instance.
let smtp: Transporter | null = null;
function smtpTransport(): Transporter {
  if (smtp) return smtp;
  if (process.env.SMTP_URL) {
    smtp = nodemailer.createTransport(process.env.SMTP_URL);
  } else {
    const port = Number(process.env.SMTP_PORT ?? 587);
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 = implicit TLS; 587/25 upgrade with STARTTLS.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return smtp;
}

const resend = emailProvider === "resend" ? new Resend(process.env.RESEND_API_KEY) : null;

type MailKind = "verify" | "reset" | "notice";

type Mail = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  url: string;
  cta: string;
  /** Picks the accent colour, icon and security note. */
  kind?: MailKind;
  /** Short note shown in a highlighted box under the button. */
  note?: string;
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const THEMES: Record<MailKind, { accent: string; soft: string; icon: string; label: string; tip: string }> = {
  verify: {
    accent: "#2563eb",
    soft: "#eff6ff",
    icon: "✉️",
    label: "Email verification",
    tip: "If you didn't create a Veylix account, you can safely ignore this email.",
  },
  reset: {
    accent: "#d97706",
    soft: "#fffbeb",
    icon: "🔑",
    label: "Password reset",
    tip: "If you didn't ask to reset your password, ignore this email. Your password won't change.",
  },
  notice: {
    accent: "#059669",
    soft: "#ecfdf5",
    icon: "🔔",
    label: "Account notice",
    tip: "If this wasn't you, sign in and review your account security.",
  },
};

/**
 * Table-based, inline-styled layout so it renders consistently in Outlook,
 * Gmail and Apple Mail. Gradients have solid `bgcolor` fallbacks for Outlook desktop.
 */
export function renderEmail({ heading, body, url, cta, kind = "notice", note }: Omit<Mail, "to" | "subject">) {
  const t = THEMES[kind];
  const [h, b, u, c] = [heading, body, url, cta].map(escapeHtml);
  const n = note ? escapeHtml(note) : null;
  const appUrl = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(t.label)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:${font};color:#0f172a;-webkit-font-smoothing:antialiased">
  <!-- Inbox preview text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${b}</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef2f7" style="background:#eef2f7">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">

        <!-- Brand header -->
        <tr><td bgcolor="#2563eb" style="background:#2563eb;background-image:linear-gradient(135deg,#2563eb 0%,#4f46e5 50%,#059669 100%);border-radius:16px 16px 0 0;padding:28px 32px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="40" height="40" align="center" valign="middle" bgcolor="#4f7cf0" style="width:40px;height:40px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:10px;color:#ffffff;font-size:20px;font-weight:800;font-family:${font}">V</td>
            <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;font-family:${font}">Veylix</td>
          </tr></table>
          <p style="margin:18px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600">${escapeHtml(t.label)}</p>
        </td></tr>

        <!-- Card -->
        <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:36px 32px 28px;border-radius:0 0 16px 16px;box-shadow:0 8px 24px rgba(15,23,42,0.06)">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="52" height="52" align="center" valign="middle" bgcolor="${t.soft}" style="width:52px;height:52px;background:${t.soft};border-radius:14px;font-size:26px;line-height:52px">${t.icon}</td>
          </tr></table>

          <h1 style="margin:22px 0 10px;font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;letter-spacing:-0.4px">${h}</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#475569">${b}</p>

          <!-- Bulletproof button -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" bgcolor="${t.accent}" style="border-radius:10px;background:${t.accent}">
              <a href="${u}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;font-family:${font}">${c} &rarr;</a>
            </td>
          </tr></table>

          ${
            n
              ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px"><tr>
            <td bgcolor="${t.soft}" style="background:${t.soft};border-left:4px solid ${t.accent};border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.55;color:#334155">⏱ ${n}</td>
          </tr></table>`
              : ""
          }

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px">

          <p style="margin:0 0 6px;font-size:12px;color:#64748b">Button not working? Paste this link into your browser:</p>
          <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all"><a href="${u}" style="color:${t.accent};text-decoration:underline">${u}</a></p>

          <p style="margin:0;font-size:12px;line-height:1.55;color:#64748b">🔒 ${escapeHtml(t.tip)}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding:24px 16px 8px">
          <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600">Veylix · Env Manager &amp; Password Vault</p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8">
            You received this email because of activity on your Veylix account.${
              appUrl ? `<br><a href="${escapeHtml(appUrl)}" style="color:#94a3b8;text-decoration:underline">Open Veylix</a>` : ""
            }
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `VEYLIX · ${t.label.toUpperCase()}`,
    "",
    heading,
    "",
    body,
    "",
    `${cta}: ${url}`,
    ...(note ? ["", note] : []),
    "",
    t.tip,
    "",
    "You received this email because of activity on your Veylix account.",
  ].join("\n");
  return { html, text };
}

/** Single integration point for all outgoing email. */
export async function sendMail({ to, subject, ...content }: Mail) {
  if (emailProvider === "console") {
    console.log(`\n📧 [dev email] to=${to} subject="${subject}"\n   ${content.url}\n`);
    return;
  }

  const { html, text } = renderEmail(content);

  if (emailProvider === "resend") {
    const { error } = await resend!.emails.send({ from: FROM, to, subject, html, text });
    if (error) throw new Error(`Failed to send email: ${error.message}`);
    return;
  }

  try {
    await smtpTransport().sendMail({ from: FROM, to, subject, html, text });
  } catch (e) {
    // Log the real cause server-side; don't leak SMTP details to the user.
    console.error("[email] SMTP send failed:", e);
    throw new Error("Failed to send email");
  }
}
