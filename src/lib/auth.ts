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
        body: "Someone requested a password reset for your account. This link expires in 1 hour. If it wasn't you, ignore this email.",
        url,
        cta: "Reset password",
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
        heading: `Welcome, ${user.name}!`,
        body: "Confirm your email address to finish creating your account. This link expires in 1 hour.",
        url,
        cta: "Verify email",
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
