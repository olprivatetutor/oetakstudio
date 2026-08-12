import "dotenv/config";
import { Client } from "pg";

/**
 * Sets/rotates the password for the non-owner `app_rw` runtime role used by
 * `db/runtime.ts` (ADR-009 / §16.3.2). The role itself is created idempotently
 * by drizzle/0012_rls_workspace_hardening.sql — this script only supplies the
 * secret, which must never be committed to source control.
 *
 * Usage: RUNTIME_DB_PASSWORD=... npm run db:setup-runtime-role
 */
async function main() {
  const adminUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  const password = process.env.RUNTIME_DB_PASSWORD;

  if (!adminUrl) {
    throw new Error("Set MIGRATION_DATABASE_URL (or DATABASE_URL) to an owner/superuser connection string.");
  }
  if (!password) {
    throw new Error("Set RUNTIME_DB_PASSWORD to the password app_rw should authenticate with.");
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query("select 1 from pg_roles where rolname = 'app_rw'");
    if (rows.length === 0) {
      throw new Error(
        "Role 'app_rw' does not exist yet. Run `npm run db:migrate` first (drizzle/0012_rls_workspace_hardening.sql creates it).",
      );
    }
    await client.query(`ALTER ROLE app_rw WITH PASSWORD '${password.replace(/'/g, "''")}'`);
    console.log(
      "app_rw password set. Point RUNTIME_DATABASE_URL at this role, e.g.\n" +
        "  postgresql://app_rw:<password>@<host>:<port>/<database>",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
