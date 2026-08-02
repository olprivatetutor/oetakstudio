import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
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
import { hashPassword, verifyPassword } from "@/lib/security/password";

const emailProvider = createEmailProvider();
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
