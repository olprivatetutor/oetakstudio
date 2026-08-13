import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * PLATFORM vs WORKSPACE role-scope separation (NEW-8, AGENTS.md §6.5, §22).
 *
 * Before drizzle/0015, `membership_roles` had no scope constraint, so any ACTIVE
 * workspace member could insert (own_membership_id, SUPER_ADMIN). Because the
 * canonical permission union walks
 * workspace_memberships -> membership_roles -> role_permissions, that grants
 * `platform.administer` and `platform.elevate` through a workspace membership.
 *
 * Enforcement is deliberately doubled: a trigger (fires for every writer,
 * including the table owner and seeds) plus RLS predicates (stop the runtime
 * role at the policy boundary first). Both are exercised here.
 */
const ownerUrl = process.env.RLS_TEST_DATABASE_URL;
const RUNTIME_TEST_PASSWORD = "rls-test-password";

if (!ownerUrl) {
  console.error(
    "\n!! Role-scope tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! PLATFORM role escalation is NOT verified by this run.\n",
  );
}

function runtimeUrl(owner: string) {
  const url = new URL(owner);
  url.username = "app_rw";
  url.password = RUNTIME_TEST_PASSWORD;
  return url.toString();
}

async function asRuntime<T>(
  url: string,
  ctx: { userId?: string | null; workspaceId?: string | null },
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.current_user_id', $1, true)", [ctx.userId ?? ""]);
    await client.query("select set_config('app.current_workspace_id', $1, true)", [
      ctx.workspaceId ?? "",
    ]);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

const suite = ownerUrl ? test : test.skip;

suite("platform/workspace role scope separation", async (t) => {
  const owner = new Client({ connectionString: ownerUrl! });
  await owner.connect();

  const ids = {
    member: `u-mem-${randomUUID()}`,
    orgOwner: `u-own-${randomUUID()}`,
  };
  const created: string[] = [];

  t.after(async () => {
    if (created.length > 0) {
      await owner.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [created]);
    }
    await owner.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [Object.values(ids)]);
    await owner.end();
  });

  await owner.query(
    `ALTER ROLE app_rw WITH PASSWORD '${RUNTIME_TEST_PASSWORD.replace(/'/g, "''")}'`,
  );
  for (const id of Object.values(ids)) {
    await owner.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Role',$2,true,'ADULT',now(),now())`,
      [id, `${id}@example.test`],
    );
  }

  const url = runtimeUrl(ownerUrl!);

  async function bootstrap(userId: string, roleCodes: string) {
    const id = await asRuntime(url, { userId }, async (c) =>
      (
        await c.query(
          `SELECT app_bootstrap_workspace('ORGANIZATION','Scope',string_to_array($1,','),9) AS id`,
          [roleCodes],
        )
      ).rows[0].id as string,
    );
    created.push(id);
    return id;
  }

  async function membershipOf(workspaceId: string) {
    return (
      await owner.query(`SELECT "id" FROM "workspace_memberships" WHERE "workspace_id" = $1`, [
        workspaceId,
      ])
    ).rows[0].id as string;
  }

  async function roleId(code: string) {
    return (await owner.query(`SELECT "id" FROM "roles" WHERE "code" = $1`, [code])).rows[0]
      .id as string;
  }

  await t.test("1. an ordinary member cannot grant themselves SUPER_ADMIN", async () => {
    const ws = await bootstrap(ids.member, "LEARNER");
    const membership = await membershipOf(ws);
    const superAdmin = await roleId("SUPER_ADMIN");

    await assert.rejects(
      asRuntime(url, { userId: ids.member, workspaceId: ws }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          membership,
          superAdmin,
        ]),
      ),
      (error: unknown) => {
        // 42501 from the RLS predicate, or 23514 from the trigger — either is a
        // refusal; what matters is that no row is written.
        assert.ok(["42501", "23514"].includes((error as { code?: string }).code ?? ""));
        return true;
      },
    );

    const { rows } = await owner.query(
      `SELECT count(*)::int AS n FROM "membership_roles" WHERE "membership_id" = $1 AND "role_id" = $2`,
      [membership, superAdmin],
    );
    assert.equal(rows[0].n, 0, "no PLATFORM role row may exist");
  });

  await t.test("2. an ORG_OWNER cannot grant SUPER_ADMIN", async () => {
    const ws = await bootstrap(ids.orgOwner, "ORG_OWNER");
    const membership = await membershipOf(ws);
    const superAdmin = await roleId("SUPER_ADMIN");

    await assert.rejects(
      asRuntime(url, { userId: ids.orgOwner, workspaceId: ws }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          membership,
          superAdmin,
        ]),
      ),
      (error: unknown) => {
        assert.ok(["42501", "23514"].includes((error as { code?: string }).code ?? ""));
        return true;
      },
    );
  });

  await t.test("3. an ORG_OWNER cannot grant PLATFORM_CONTENT_ADMIN", async () => {
    const ws = await bootstrap(ids.orgOwner, "ORG_OWNER");
    const membership = await membershipOf(ws);
    const contentAdmin = await roleId("PLATFORM_CONTENT_ADMIN");

    await assert.rejects(
      asRuntime(url, { userId: ids.orgOwner, workspaceId: ws }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          membership,
          contentAdmin,
        ]),
      ),
      (error: unknown) => {
        assert.ok(["42501", "23514"].includes((error as { code?: string }).code ?? ""));
        return true;
      },
    );
  });

  await t.test("4. workspace bootstrap cannot assign PLATFORM roles", async () => {
    const ws = await bootstrap(ids.member, "ORG_OWNER,SUPER_ADMIN,PLATFORM_CONTENT_ADMIN");
    const { rows } = await owner.query(
      `SELECT r."code", r."scope" FROM "workspace_memberships" wm
         JOIN "membership_roles" mr ON mr."membership_id" = wm."id"
         JOIN "roles" r ON r."id" = mr."role_id"
        WHERE wm."workspace_id" = $1`,
      [ws],
    );
    assert.deepEqual(
      rows.map((row) => row.code).sort(),
      ["ORG_OWNER"],
      "bootstrap must silently drop PLATFORM roles and grant only WORKSPACE ones",
    );
  });

  await t.test("5. the trigger holds even for the table owner", async () => {
    // RLS does not apply to a superuser, so without the trigger this write would
    // succeed. It is the structural half of the control.
    const ws = await bootstrap(ids.member, "LEARNER");
    const membership = await membershipOf(ws);
    const superAdmin = await roleId("SUPER_ADMIN");

    await assert.rejects(
      owner.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
        membership,
        superAdmin,
      ]),
      /ROLE_SCOPE_VIOLATION/,
      "the owner connection must be refused too",
    );
  });

  await t.test("6. only user_platform_roles may hold a PLATFORM role", async () => {
    const superAdmin = await roleId("SUPER_ADMIN");
    const learner = await roleId("LEARNER");

    // The canonical privileged path works...
    await owner.query(`INSERT INTO "user_platform_roles" ("user_id","role_id") VALUES ($1,$2)`, [
      ids.orgOwner,
      superAdmin,
    ]);
    const { rows } = await owner.query(
      `SELECT count(*)::int AS n FROM "user_platform_roles" WHERE "user_id" = $1`,
      [ids.orgOwner],
    );
    assert.equal(rows[0].n, 1, "platform roles are assignable through the platform path");

    // ...and the symmetric guard rejects a WORKSPACE role granted platform-wide.
    await assert.rejects(
      owner.query(`INSERT INTO "user_platform_roles" ("user_id","role_id") VALUES ($1,$2)`, [
        ids.member,
        learner,
      ]),
      /ROLE_SCOPE_VIOLATION/,
      "a WORKSPACE role must not be grantable as a platform role",
    );

    // The runtime role has no write privilege on that table at all.
    await assert.rejects(
      asRuntime(url, { userId: ids.member }, (c) =>
        c.query(`INSERT INTO "user_platform_roles" ("user_id","role_id") VALUES ($1,$2)`, [
          ids.member,
          superAdmin,
        ]),
      ),
      /permission denied/i,
    );

    await owner.query(`DELETE FROM "user_platform_roles" WHERE "user_id" = $1`, [ids.orgOwner]);
  });

  await t.test("no PLATFORM permission is reachable through a membership union", async () => {
    // The escalation this whole migration exists to prevent, asserted end to end
    // against the exact query shape lib/services/workspace.ts uses.
    const { rows } = await owner.query(
      `SELECT count(*)::int AS n
         FROM "workspace_memberships" wm
         JOIN "membership_roles" mr ON mr."membership_id" = wm."id"
         JOIN "role_permissions" rp ON rp."role_id" = mr."role_id"
         JOIN "permissions" p ON p."id" = rp."permission_id"
        WHERE p."code" IN ('platform.administer','platform.elevate')`,
    );
    assert.equal(rows[0].n, 0, "platform permissions must never be reachable via membership roles");
  });
});
