import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { z } from "zod";
import { db } from "@/db";
import {
  account,
  rateLimit,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "@/db/schema/auth";
import { createEmailProvider } from "@/lib/email/factory";
import { resolveAgeBand } from "@/lib/ai/safety";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { ensurePersonalWorkspaceForUser } from "@/lib/services/workspace";

const emailProvider = createEmailProvider();
const birthDateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must use YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Birth date is invalid")
  .refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "Birth date cannot be in the future",
  );
const googleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
  : undefined;

function authEmail(input: { to: string; subject: string; action: string; url: string }) {
  return emailProvider.send({
    to: input.to,
    subject: input.subject,
    text: `${input.action}: ${input.url}`,
    html: `<p>${input.action}</p><p><a href="${input.url}">${input.url}</a></p>`,
  });
}

export const auth = betterAuth({
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",").map((origin) => origin.trim()),
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined,
    process.env.NODE_ENV === "development" ? "http://localhost:3001" : undefined,
  ].filter(Boolean) as string[],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      account,
      session,
      verification,
      rateLimit,
      twoFactor: twoFactorTable,
    },
  }),
  user: {
    additionalFields: {
      // Accepted only as registration input and never returned in auth/session
      // payloads (§3.6/§16.5 data minimization).
      birthDate: {
        type: "string",
        required: false,
        returned: false,
        validator: { input: birthDateInputSchema },
      },
      // Server-owned. Better Auth excludes a client-supplied value from create
      // and update inputs before any user row is written.
      ageBand: {
        type: "string",
        required: false,
        input: false,
        returned: false,
        defaultValue: "UNSPECIFIED",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(newUser, context) {
          const birthDate = typeof newUser.birthDate === "string" ? newUser.birthDate : null;

          // Email/password registration is the canonical input path and must
          // capture a birth date. OAuth providers do not reliably supply one;
          // those accounts remain genuinely UNSPECIFIED until onboarding.
          if (context?.path === "/sign-up/email" && !birthDate) {
            throw APIError.from("BAD_REQUEST", {
              code: "BIRTH_DATE_REQUIRED",
              message: "Birth date is required",
            });
          }

          return {
            data: {
              ...newUser,
              ageBand: resolveAgeBand({
                birthDate,
                ageBand: "UNSPECIFIED",
              }),
            },
          };
        },
      },
      update: {
        async before(changes, context) {
          // Registration stores birth_date once. Normal profile updates may not
          // directly alter either the source date or its derived safety band.
          if (
            context?.path === "/update-user" &&
            ("birthDate" in changes || "ageBand" in changes)
          ) {
            throw APIError.from("BAD_REQUEST", {
              code: "AGE_FIELDS_IMMUTABLE",
              message: "Age safety fields cannot be changed through profile updates",
            });
          }
        },
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: ({ user: authUser, url }) => authEmail({
      to: authUser.email,
      subject: "Verify your Oetak account",
      action: "Verify your email address",
      url,
    }),
    // Better Auth runs this only after `emailVerified` has been persisted. The
    // bootstrap itself is atomic and idempotent; requireUser also reconciles it
    // so a transient callback failure is repaired on the next authenticated
    // request instead of becoming permanent partial state.
    afterEmailVerification: async (verifiedUser) => {
      await ensurePersonalWorkspaceForUser(verifiedUser);
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: { hash: hashPassword, verify: verifyPassword },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: ({ user: authUser, url }) => authEmail({
      to: authUser.email,
      subject: "Reset your Oetak password",
      action: "Reset your password",
      url,
    }),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 15,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
    },
  },
  socialProviders: googleOAuth,
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] }, encryptOAuthTokens: true },
  plugins: [
    twoFactor({
      issuer: "Oetak",
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
    }),
  ],
});
