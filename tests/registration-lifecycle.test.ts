import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * NEW-18 + Personal Workspace lifecycle integration.
 *
 * This uses Better Auth's real HTTP handler so the test covers its additional
 * field parser, database hooks, email-verification callback, and the canonical
 * workspace bootstrap service rather than simulating route-level inserts.
 */
const dbUrl = process.env.RLS_TEST_DATABASE_URL;

if (!dbUrl) {
  console.error(
    "\n!! Registration lifecycle tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! Registration age derivation and Personal Workspace provisioning are NOT verified.\n",
  );
}

const suite = dbUrl ? test : test.skip;

suite("registration safety and Personal Workspace lifecycle", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  process.env.BETTER_AUTH_SECRET = "registration-lifecycle-test-secret-at-least-32-characters";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.EMAIL_FROM = "tests@oetak.invalid";

  const originalFetch = globalThis.fetch;
  const verificationUrls = new Map<string, string>();
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    const body = JSON.parse(String(init?.body)) as { to: string[]; html: string };
    const href = body.html.match(/href="([^"]+)"/)?.[1];
    assert.ok(href, "verification email must contain its Better Auth callback URL");
    verificationUrls.set(body.to[0], href);
    return Response.json({ id: `email-${randomUUID()}` });
  };

  const { auth } = await import("@/lib/auth");
  const { ensurePersonalWorkspaceForUser } = await import("@/lib/services/workspace");
  const { resolveSafetyProfile } = await import("@/lib/ai/safety");

  const client = new Client({ connectionString: dbUrl! });
  await client.connect();
  await client.query(`DELETE FROM "rate_limit" WHERE "key" LIKE '%|/sign-up/email'`);
  const emails: string[] = [];

  t.after(async () => {
    try {
      const users = await client.query(`SELECT "id" FROM "user" WHERE "email" = ANY($1)`, [emails]);
      const userIds = users.rows.map((row) => row.id as string);
      if (userIds.length > 0) {
        await client.query(
          `DELETE FROM "workspaces" WHERE "type" = 'PERSONAL' AND "created_by_id" = ANY($1)`,
          [userIds],
        );
        await client.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [userIds]);
      }
    } finally {
      globalThis.fetch = originalFetch;
      await client.end();
    }
  });

  function authRequest(path: string, body?: Record<string, unknown>, cookie?: string) {
    return auth.handler(
      new Request(`http://localhost:3000/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin: "http://localhost:3000",
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  }

  async function registerAndVerify(label: string, birthDate: string, expectedAgeBand: string) {
    const email = `registration-${label}-${randomUUID()}@example.test`;
    emails.push(email);

    const signUpResponse = await authRequest("/sign-up/email", {
      name: `${label} Learner`,
      email,
      password: "Lifecycle@2026!",
      birthDate,
    });
    const signUpText = await signUpResponse.text();
    assert.equal(signUpResponse.status, 200, signUpText);
    const signUpBody = JSON.parse(signUpText);
    assert.doesNotMatch(
      JSON.stringify(signUpBody),
      /birthDate|birth_date|ageBand|age_band/,
      "minimized age fields must not be returned by the auth API",
    );

    const beforeVerification = await client.query(
      `SELECT "id", "name", "birth_date"::text AS birth_date, "age_band", "email_verified"
         FROM "user" WHERE "email" = $1`,
      [email],
    );
    assert.equal(beforeVerification.rows.length, 1);
    assert.equal(beforeVerification.rows[0].birth_date, birthDate);
    assert.equal(beforeVerification.rows[0].age_band, expectedAgeBand);
    assert.equal(beforeVerification.rows[0].email_verified, false);

    const preWorkspace = await client.query(
      `SELECT count(*)::int AS n FROM "workspaces"
        WHERE "type" = 'PERSONAL' AND "created_by_id" = $1`,
      [beforeVerification.rows[0].id],
    );
    assert.equal(preWorkspace.rows[0].n, 0, "workspace lifecycle waits for email verification");

    const verificationUrl = verificationUrls.get(email);
    assert.ok(verificationUrl, "the verification email must have been sent");
    const verifyResponse = await auth.handler(
      new Request(verificationUrl, { headers: { origin: "http://localhost:3000" } }),
    );
    assert.ok(
      verifyResponse.status === 200 || (verifyResponse.status >= 300 && verifyResponse.status < 400),
      `unexpected verification response ${verifyResponse.status}`,
    );

    const cookie = verifyResponse.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, "autoSignInAfterVerification must issue a session cookie");

    const lifecycle = await client.query(
      `SELECT w."id" AS workspace_id, w."type", w."status" AS workspace_status,
              wm."id" AS membership_id, wm."user_id", wm."status" AS membership_status,
              array_agg(r."code" ORDER BY r."code") AS role_codes
         FROM "workspaces" w
         JOIN "workspace_memberships" wm ON wm."workspace_id" = w."id"
         JOIN "membership_roles" mr ON mr."membership_id" = wm."id"
         JOIN "roles" r ON r."id" = mr."role_id"
        WHERE w."type" = 'PERSONAL' AND w."created_by_id" = $1
        GROUP BY w."id", wm."id"`,
      [beforeVerification.rows[0].id],
    );
    assert.equal(lifecycle.rows.length, 1, "registration creates exactly one Personal Workspace");
    assert.equal(lifecycle.rows[0].type, "PERSONAL");
    assert.equal(lifecycle.rows[0].workspace_status, "ACTIVE");
    assert.equal(lifecycle.rows[0].user_id, beforeVerification.rows[0].id);
    assert.equal(lifecycle.rows[0].membership_status, "ACTIVE");
    assert.deepEqual(lifecycle.rows[0].role_codes, ["LEARNER"]);

    const allMembers = await client.query(
      `SELECT count(*)::int AS n FROM "workspace_memberships" WHERE "workspace_id" = $1`,
      [lifecycle.rows[0].workspace_id],
    );
    assert.equal(allMembers.rows[0].n, 1, "the initial membership belongs only to this user");

    return {
      id: beforeVerification.rows[0].id as string,
      name: beforeVerification.rows[0].name as string,
      workspaceId: lifecycle.rows[0].workspace_id as string,
      cookie,
    };
  }

  const currentYear = new Date().getUTCFullYear();
  const under13Date = `${currentYear - 10}-01-01`;
  const teenDate = `${currentYear - 15}-01-01`;
  const adultDate = `${currentYear - 30}-01-01`;

  const child = await registerAndVerify("child", under13Date, "UNDER_13");
  await registerAndVerify("teen", teenDate, "TEEN_13_17");
  await registerAndVerify("adult", adultDate, "ADULT");

  await t.test("spoofed age band is ignored and missing birth date is rejected", async () => {
    const spoofedEmail = `registration-spoof-${randomUUID()}@example.test`;
    const missingEmail = `registration-missing-${randomUUID()}@example.test`;
    emails.push(spoofedEmail, missingEmail);

    const spoofed = await authRequest("/sign-up/email", {
      name: "Spoofed Learner",
      email: spoofedEmail,
      password: "Lifecycle@2026!",
      birthDate: under13Date,
      ageBand: "ADULT",
    });
    assert.equal(spoofed.status, 200);

    const spoofedStored = await client.query(
      `SELECT "birth_date"::text AS birth_date, "age_band" FROM "user" WHERE "email" = $1`,
      [spoofedEmail],
    );
    assert.equal(spoofedStored.rows.length, 1);
    assert.equal(spoofedStored.rows[0].birth_date, under13Date);
    assert.equal(
      spoofedStored.rows[0].age_band,
      "UNDER_13",
      "the client-supplied ADULT value must not override server derivation",
    );

    const missing = await authRequest("/sign-up/email", {
      name: "Missing Learner",
      email: missingEmail,
      password: "Lifecycle@2026!",
    });
    assert.equal(missing.status, 400);

    const rows = await client.query(`SELECT "id" FROM "user" WHERE "email" = $1`, [missingEmail]);
    assert.equal(rows.rows.length, 0, "missing birth date must not create a user");
  });

  await t.test("normal profile updates cannot modify age safety fields", async () => {
    const ageBandUpdate = await authRequest(
      "/update-user",
      { ageBand: "ADULT" },
      child.cookie,
    );
    assert.equal(ageBandUpdate.status, 400);

    const birthDateUpdate = await authRequest(
      "/update-user",
      { birthDate: adultDate },
      child.cookie,
    );
    assert.equal(birthDateUpdate.status, 400);

    const stored = await client.query(
      `SELECT "birth_date"::text AS birth_date, "age_band" FROM "user" WHERE "id" = $1`,
      [child.id],
    );
    assert.equal(stored.rows[0].birth_date, under13Date);
    assert.equal(stored.rows[0].age_band, "UNDER_13");
  });

  await t.test("retries converge on the same Personal Workspace", async () => {
    const results = await Promise.all([
      ensurePersonalWorkspaceForUser(child),
      ensurePersonalWorkspaceForUser(child),
      ensurePersonalWorkspaceForUser(child),
    ]);
    assert.deepEqual(
      new Set(results.map((result) => result.workspace.id)),
      new Set([child.workspaceId]),
    );

    const count = await client.query(
      `SELECT count(*)::int AS n FROM "workspaces"
        WHERE "type" = 'PERSONAL' AND "created_by_id" = $1`,
      [child.id],
    );
    assert.equal(count.rows[0].n, 1);
  });

  await t.test("AI safety resolves the persisted band and denies unconsented UNDER_13", async () => {
    const safety = await resolveSafetyProfile(child.id);
    assert.equal(safety.ageBand, "UNDER_13");
    assert.equal(safety.effectiveBand, "UNDER_13");
    assert.equal(safety.consentSatisfied, false);
    assert.equal(safety.aiFeaturesAllowed, false);
    assert.equal(safety.denyReason, "CONSENT_REQUIRED");
  });
});
