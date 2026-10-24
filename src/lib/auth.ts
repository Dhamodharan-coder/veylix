import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins/bearer";
import { prisma } from "@/lib/db";
import { emailEnabled, sendMail } from "@/lib/email";

// OAuth providers are enabled only when their credentials are configured.
const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

export const enabledProviders = {
  github: "github" in socialProviders,
  google: "google" in socialProviders,
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Brute-force protection for the auth API (per IP). Stored in the database so
  // limits hold across serverless instances. Disable locally with RATE_LIMIT_ENABLED=false.
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== "false",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/reset-password": { window: 60 * 60, max: 10 },
      "/send-verification-email": { window: 10 * 60, max: 3 },
      "/verify-password": { window: 5 * 60, max: 5 },
      "/change-password": { window: 60 * 60, max: 10 },
      "/sign-in/social": { window: 60, max: 10 },
      // Polled by the app and the extension; don't throttle normal use.
      "/get-session": false,
    },
  },
  emailAndPassword: {
    enabled: true,
    // Verification is only enforced once email sending is turned on.
    requireEmailVerification: emailEnabled,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your Veylix password",
        heading: "Reset your password",
        body: `Hi ${user.name}, we received a request to reset the password for your Veylix account. Click the button below to choose a new one.`,
        url,
        cta: "Reset password",
        kind: "reset",
        note: "This link expires in 1 hour and can only be used once.",
      });
    },
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    sendOnSignIn: emailEnabled,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Verify your Veylix email",
        heading: `Welcome to Veylix, ${user.name}!`,
        body: "You're one step away from managing your environment variables and passwords securely. Confirm your email address to activate your account.",
        url,
        cta: "Verify email address",
        kind: "verify",
        note: "This verification link expires in 1 hour.",
      });
    },
  },
  socialProviders,
  plugins: [
    // Lets the browser extension authenticate with the signed session token
    // (read from the Veylix cookie) as `Authorization: Bearer <token>`.
    bearer({ requireSignature: true }),
    // Must stay last so cookies set inside Server Actions reach the browser.
    nextCookies(),
  ],
});
