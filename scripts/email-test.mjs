// Checks the email settings in .env and sends a test message.
// Usage: npm run email:test -- you@example.com
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const to = process.argv[2];
if (!to) {
  console.error("Usage: npm run email:test -- you@example.com");
  process.exit(1);
}

const env = process.env;
const from = env.EMAIL_FROM ?? "Veylix <no-reply@veylix.local>";
const forced = env.EMAIL_PROVIDER?.toLowerCase();
const provider = forced || (env.SMTP_URL || env.SMTP_HOST ? "smtp" : env.RESEND_API_KEY ? "resend" : "console");

console.log(`EMAIL_ENABLED = ${env.EMAIL_ENABLED ?? "(unset)"}${env.EMAIL_ENABLED === "true" ? "" : "  ← the app won't send email until this is \"true\""}`);
console.log(`Provider      = ${provider}`);
console.log(`From          = ${from}\n`);

const message = {
  from,
  to,
  subject: "Veylix email test",
  text: "Your Veylix email settings work. 🎉",
  html: "<p style=\"font-family:system-ui,sans-serif\">Your <b>Veylix</b> email settings work. 🎉</p>",
};

try {
  if (provider === "smtp") {
    const port = Number(env.SMTP_PORT ?? 587);
    const transport = env.SMTP_URL
      ? nodemailer.createTransport(env.SMTP_URL)
      : nodemailer.createTransport({
          host: env.SMTP_HOST,
          port,
          secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
        });
    console.log(`Connecting to ${env.SMTP_URL ? "SMTP_URL" : `${env.SMTP_HOST}:${port}`}…`);
    await transport.verify();
    console.log("✓ SMTP login OK");
    const info = await transport.sendMail(message);
    console.log(`✓ Sent to ${to} (message id ${info.messageId})`);
  } else if (provider === "resend") {
    const { data, error } = await new Resend(env.RESEND_API_KEY).emails.send(message);
    if (error) throw new Error(error.message);
    console.log(`✓ Sent to ${to} via Resend (id ${data?.id})`);
  } else {
    console.log("No provider configured. Set SMTP_HOST (or SMTP_URL) or RESEND_API_KEY in .env.");
    process.exit(1);
  }
} catch (e) {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  console.error("\nCommon fixes: check host/port, use an app password (Gmail/Outlook/Zoho), and SMTP_SECURE=true only for port 465.");
  process.exit(1);
}
