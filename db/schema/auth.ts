import { pgTable, text, timestamp, boolean, integer, bigint, uniqueIndex, pgEnum, date } from "drizzle-orm/pg-core";

// ADR-007 (app_summary.md §3.6): resolved from birth_date where provided, else a
// self-declared band, else UNSPECIFIED. UNSPECIFIED fails closed as TEEN_13_17 for
// AI safety-profile purposes (enforced by the safety-profile resolver, not here).
export const ageBandEnum = pgEnum("age_band", [
    "UNDER_13",
    "TEEN_13_17",
    "ADULT",
    "UNSPECIFIED",
]);

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified")
        .$defaultFn(() => false)
        .notNull(),
    image: text("image"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    // Minimized per §16.5: never exposed in list endpoints or analytics exports.
    birthDate: date("birth_date"),
    ageBand: ageBandEnum("age_band").default("UNSPECIFIED").notNull(),
    createdAt: timestamp("created_at")
        .$defaultFn(() => /* @__PURE__ */ new Date())
        .notNull(),
    updatedAt: timestamp("updated_at")
        .$defaultFn(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").$defaultFn(
        () => /* @__PURE__ */ new Date(),
    ),
    updatedAt: timestamp("updated_at").$defaultFn(
        () => /* @__PURE__ */ new Date(),
    ),
});

export const rateLimit = pgTable("rate_limit", {
    // Better Auth adapters uniformly materialize an id field, including for
    // database-backed rate-limit rows. `key` remains the logical primary key.
    id: text("id").$defaultFn(() => crypto.randomUUID()).notNull().unique(),
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const twoFactor = pgTable("two_factor", {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
}, (table) => [uniqueIndex("two_factor_user_unique").on(table.userId)]);
