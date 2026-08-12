import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Migrations always run as the owner/migration role (ADR-009 / §16.3.2), never
// as the non-owner `app_rw` runtime role used by db/runtime.ts. Falls back to
// DATABASE_URL so existing single-connection-string setups keep working.
export default defineConfig({
    out: './drizzle',
    schema: './db/schema/*',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL!,
    },
});
