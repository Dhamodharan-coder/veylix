import "server-only";
import { Resend } from "resend";

/**
 * Master switch for all outgoing email (verification, password reset).
 * Off by default: no mail is sent, email verification is not required,
 * and links are printed to the server terminal instead.
 */
export const emailEnabled = process.env.EMAIL_ENABLED === "true";

const resend = emailEnabled && process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type Mail = { to: string; subject: string; heading: string; body: string; url: string; cta: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Single integration point for email: swap the Resend call below for your
// mail microservice when it's ready.
export async function sendMail({ to, subject, heading, body, url, cta }: Mail) {
  // Email disabled (or no provider configured): print the link instead.
  if (!resend) {
    console.log(`\n📧 [dev email] to=${to} subject="${subject}"\n   ${url}\n`);
    return;
  }

  [heading, body, url, cta] = [heading, body, url, cta].map(escapeHtml);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2>${heading}</h2>
      <p>${body}</p>
      <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">${cta}</a></p>
      <p style="color:#666;font-size:12px">If the button doesn't work, open this link:<br>${url}</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "EnvMan <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
