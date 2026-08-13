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
      //
      // The exit is explicit: a successful probe leaves an idle node-postgres
      // pool holding the event loop open, which would otherwise hang until the
      // execFile timeout. `write`'s callback fires after the pipe is flushed, so
      // the result is never truncated by the exit.
      `import('./db/runtime.ts').then(async (ns) => { const m = ns.default ?? ns; ${script} })` +
        `.then(() => 'OK').catch((e) => 'THREW:' + e.message)` +
        `.then((out) => process.stdout.write(out + '\\n', () => process.exit(0)))`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      timeout: 60_000,
    },
  );
  return stdout.trim().split("\n").at(-1) ?? "";
}

test("NEW-3: importing the module in production does not throw", async () => {
  // `next build` runs with NODE_ENV=production. Throwing at module load would
  // break the build on any machine whose build-time environment differs from its
  // runtime environment, so the guard must not fire on import alone.
  const result = await probe(
    { NODE_ENV: "production", RUNTIME_DATABASE_URL: "" },
    "return m.runtimeDb;",
  );
  assert.equal(result, "OK", "module import must be side-effect free in production");
});

test("production still fails closed before any protected query runs", async () => {
  const result = await probe(
    { NODE_ENV: "production", RUNTIME_DATABASE_URL: "" },
    "return m.withUserContext('u-probe', async () => 1);",
  );
  assert.match(result, /^THREW:/, "the first protected query must fail closed");
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

dbSuite("NEW-4: a failed privilege assertion is retried, not cached forever", async () => {
  // First call fails the production guard; the configuration is then corrected
  // in-process and the second call must succeed. A memoised rejection would make
  // the second call fail identically and require a restart to recover.
  //
  // DATABASE_URL is pointed at app_rw so the connection built at module load is
  // already the correct one — only the missing env var is at fault.
  const appRw = runtimeUrl(ownerUrl!);
  const result = await probe(
    { NODE_ENV: "production", RUNTIME_DATABASE_URL: "", DATABASE_URL: appRw },
    `
    let first = 'none';
    try { await m.withUserContext('u-probe', async () => 1); }
    catch (e) { first = e.message.slice(0, 40); }
    if (!first.includes('RUNTIME_DATABASE_URL')) throw new Error('expected first call to fail, got: ' + first);
    process.env.RUNTIME_DATABASE_URL = ${JSON.stringify(appRw)};
    await m.withUserContext('u-probe', async () => 1);
    return 1;
    `,
  );
  assert.equal(result, "OK", "the assertion must be retryable after the config is fixed");
});
