import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Runtime connection safety tests (P1-2, ADR-009 / §16.3.2).
 *
 * `db/runtime.ts` used to fall back to `DATABASE_URL` whenever
 * `RUNTIME_DATABASE_URL` was unset. That connects as the table owner — typically
 * a superuser, which bypasses RLS unconditionally, since FORCE ROW LEVEL
 * SECURITY does not apply to superusers. In production that silently turned
 * every policy in 0012/0013 into a no-op with no signal whatsoever.
 *
 * Two guards are asserted here:
 *   1. In production the fallback is refused outright, at module load.
 *   2. Whatever role is actually connected is verified at first use — not
 *      `app_rw` by name, but the live session — to be non-superuser, without
 *      BYPASSRLS, and not an owner of the protected tables.
 *
 * Each case runs in its own subprocess because the connection is established at
 * module load from the environment, so the scenarios cannot share a process.
 */
const execFileAsync = promisify(execFile);
const ownerUrl = process.env.RLS_TEST_DATABASE_URL;
const RUNTIME_TEST_PASSWORD = "rls-test-password";

function runtimeUrl(owner: string) {
  const url = new URL(owner);
  url.username = "app_rw";
  url.password = RUNTIME_TEST_PASSWORD;
  return url.toString();
}

/** Loads db/runtime.ts in a fresh process and reports what happened. */
async function probe(env: Record<string, string | undefined>, script: string) {
  const { stdout } = await execFileAsync(
    "node_modules/.bin/tsx",
    [
      "-e",
      // `tsx -e` evaluates as CJS, so a dynamic import of a TS module arrives
      // interop-wrapped: the real namespace is under `.default`.
      `import('./db/runtime.ts').then(async (ns) => { const m = ns.default ?? ns; ${script} })` +
        `.then(() => console.log('OK')).catch((e) => console.log('THREW:' + e.message))`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      timeout: 60_000,
    },
  );
  return stdout.trim().split("\n").at(-1) ?? "";
}

test("production refuses to fall back to the owner connection", async () => {
  const result = await probe(
    { NODE_ENV: "production", RUNTIME_DATABASE_URL: "" },
    "return m.runtimeDb;",
  );
  assert.match(result, /^THREW:/, "module load must fail closed in production");
  assert.match(result, /RUNTIME_DATABASE_URL is required in production/);
});

test("development still allows the fallback for local bootstrapping", async () => {
  const result = await probe(
    { NODE_ENV: "development", RUNTIME_DATABASE_URL: "" },
    "return m.runtimeDb;",
  );
  assert.equal(result, "OK", "the dev fallback must keep working");
});

const dbSuite = ownerUrl ? test : test.skip;

if (!ownerUrl) {
  console.error(
    "\n!! Runtime role privilege tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! The connected role is NOT verified by this run.\n",
  );
}

dbSuite("a superuser runtime connection is rejected at first use", async () => {
  // The dangerous configuration: RUNTIME_DATABASE_URL pointed at the owner.
  // Module load succeeds outside production, so the guard has to fire here.
  const result = await probe(
    { NODE_ENV: "development", RUNTIME_DATABASE_URL: ownerUrl },
    "return m.withUserContext('u-probe', async () => 1);",
  );
  assert.match(result, /^THREW:/, "a superuser runtime role must be rejected");
  assert.match(result, /cannot enforce workspace isolation/);
  assert.match(result, /is a superuser/);
});

dbSuite("the app_rw runtime connection is accepted", async () => {
  const result = await probe(
    { NODE_ENV: "development", RUNTIME_DATABASE_URL: runtimeUrl(ownerUrl!) },
    "return m.withUserContext('u-probe', async () => 1);",
  );
  assert.equal(result, "OK", "a correctly restricted runtime role must be accepted");
});
