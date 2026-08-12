import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * RLS isolation tests for the workspace/RBAC foundation
 * (drizzle/0012_rls_workspace_hardening.sql, ADR-009 / app_summary.md §16.3).
 *
 * These exercise PostgreSQL itself, not application filtering — the whole point
 * of ADR-009 is that `WHERE workspace_id = ...` in application code is not the
 * isolation boundary. They therefore need a real database with migrations
 * applied, and are skipped when one is not configured:
 *
 *   createdb oetak_rls_test
 *   MIGRATION_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/oetak_rls_test \
 *     npx drizzle-kit migrate
 *   RLS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/oetak_rls_test \
 *     npm test
 *
 * RLS_TEST_DATABASE_URL must be an owner/superuser connection: the suite seeds
 * fixtures with it and derives a separate `app_rw` connection to assert against.
 */
const ownerUrl = process.env.RLS_TEST_DATABASE_URL;
const RUNTIME_TEST_PASSWORD = "rls-test-password";

function runtimeUrl(owner: string) {
  const url = new URL(owner);
  url.username = "app_rw";
  url.password = RUNTIME_TEST_PASSWORD;
  return url.toString();
}

type Ctx = { userId?: string | null; workspaceId?: string | null };

/** Mirrors db/runtime.ts: one transaction, context via SET LOCAL, then the query. */
async function asRuntime<T>(
  url: string,
  ctx: Ctx,
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

async function expectRlsViolation(promise: Promise<unknown>, what: string) {
  await assert.rejects(
    promise,
    (error: unknown) => {
      // 42501 = insufficient_privilege, raised by a failing WITH CHECK.
      const code = (error as { code?: string }).code;
      assert.equal(code, "42501", `${what} failed with ${code}, expected an RLS violation`);
      return true;
    },
    what,
  );
}

const suite = ownerUrl ? test : test.skip;

suite("workspace RLS isolation", async (t) => {
  const owner = new Client({ connectionString: ownerUrl! });
  await owner.connect();

  // Fixtures are seeded as the owner. FORCE ROW LEVEL SECURITY does apply to a
  // plain table owner, but a superuser bypasses RLS entirely, which is why the
  // documented setup uses a superuser connection string for seeding only.
  const ids = {
    userA: `u-a-${randomUUID()}`,
    userB: `u-b-${randomUUID()}`,
    wsA: `w-a-${randomUUID()}`,
    wsB: `w-b-${randomUUID()}`,
    memA: `m-a-${randomUUID()}`,
    memB: `m-b-${randomUUID()}`,
  };

  await owner.query("ALTER ROLE app_rw WITH PASSWORD $1", [RUNTIME_TEST_PASSWORD]);
  await owner.query(
    `INSERT INTO "user" ("id","name","email","email_verified") VALUES ($1,'A',$3,true),($2,'B',$4,true)`,
    [ids.userA, ids.userB, `${ids.userA}@example.test`, `${ids.userB}@example.test`],
  );
  await owner.query(
    `INSERT INTO "workspaces" ("id","type","name","slug") VALUES ($1,'ORGANIZATION','A',$3),($2,'ORGANIZATION','B',$4)`,
    [ids.wsA, ids.wsB, `slug-${ids.wsA}`, `slug-${ids.wsB}`],
  );
  await owner.query(
    `INSERT INTO "workspace_memberships" ("id","workspace_id","user_id","status") VALUES ($1,$3,$5,'ACTIVE'),($2,$4,$6,'ACTIVE')`,
    [ids.memA, ids.memB, ids.wsA, ids.wsB, ids.userA, ids.userB],
  );
  const learnerRoleId = (await owner.query(`SELECT "id" FROM "roles" WHERE "code" = 'LEARNER'`))
    .rows[0].id as string;
  await owner.query(
    `INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2),($3,$2)`,
    [ids.memA, learnerRoleId, ids.memB],
  );

  const url = runtimeUrl(ownerUrl!);

  t.after(async () => {
    await owner.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [[ids.wsA, ids.wsB]]);
    await owner.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [[ids.userA, ids.userB]]);
    await owner.end();
  });

  await t.test("runtime role cannot bypass RLS", async () => {
    const { rows } = await owner.query(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_rw'`,
    );
    assert.equal(rows.length, 1, "app_rw role must exist");
    assert.equal(rows[0].rolsuper, false, "app_rw must not be a superuser");
    assert.equal(rows[0].rolbypassrls, false, "app_rw must not have BYPASSRLS");

    const owns = await owner.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tableowner = 'app_rw'`,
    );
    assert.equal(owns.rowCount, 0, "app_rw must not own any table (FORCE RLS assumes non-owner)");
  });

  await t.test("workspace-owned tables are ENABLE + FORCE row level security", async () => {
    const { rows } = await owner.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = ANY($1) AND relnamespace = 'public'::regnamespace`,
      [["workspaces", "workspace_memberships", "membership_roles"]],
    );
    assert.equal(rows.length, 3);
    for (const row of rows) {
      assert.equal(row.relrowsecurity, true, `${row.relname} must ENABLE ROW LEVEL SECURITY`);
      assert.equal(row.relforcerowsecurity, true, `${row.relname} must FORCE ROW LEVEL SECURITY`);
    }
  });

  await t.test("every policy on workspace-owned tables defines USING and WITH CHECK", async () => {
    // A policy without WITH CHECK lets a caller write rows into another
    // workspace even though it cannot read them (ADR-009's first defect).
    const { rows } = await owner.query(
      `SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [["workspaces", "workspace_memberships", "membership_roles"]],
    );
    assert.ok(rows.length > 0, "expected policies on the workspace-owned tables");
    for (const row of rows) {
      const label = `${row.tablename}.${row.policyname} (${row.cmd})`;
      if (["SELECT", "DELETE"].includes(row.cmd)) {
        assert.ok(row.qual, `${label} must define USING`);
      } else if (row.cmd === "INSERT") {
        assert.ok(row.with_check, `${label} must define WITH CHECK`);
      } else {
        assert.ok(row.qual, `${label} must define USING`);
        assert.ok(row.with_check, `${label} must define WITH CHECK`);
      }
    }
  });

  await t.test("missing workspace context fails closed", async () => {
    const rows = await asRuntime(url, { userId: ids.userA, workspaceId: null }, async (c) => {
      const memberships = await c.query(`SELECT "id" FROM "workspace_memberships"`);
      const roles = await c.query(`SELECT "membership_id" FROM "membership_roles"`);
      return { memberships: memberships.rows, roles: roles.rows };
    });

    // Unpinned context is the workspace switcher: own memberships only, never
    // another user's, and no role grants at all.
    assert.deepEqual(
      rows.memberships.map((r) => r.id),
      [ids.memA],
    );
    assert.deepEqual(rows.roles, []);
  });

  await t.test("no context at all sees nothing", async () => {
    const rows = await asRuntime(url, {}, async (c) => {
      const w = await c.query(`SELECT "id" FROM "workspaces"`);
      const m = await c.query(`SELECT "id" FROM "workspace_memberships"`);
      const r = await c.query(`SELECT "membership_id" FROM "membership_roles"`);
      const cat = await c.query(`SELECT "code" FROM "roles"`);
      return [w.rowCount, m.rowCount, r.rowCount, cat.rowCount];
    });
    assert.deepEqual(rows, [0, 0, 0, 0], "an unauthenticated context must read nothing");
  });

  await t.test("a member reads their own workspace", async () => {
    const rows = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) => {
      const w = await c.query(`SELECT "id" FROM "workspaces"`);
      const m = await c.query(`SELECT "id" FROM "workspace_memberships"`);
      const r = await c.query(`SELECT "membership_id" FROM "membership_roles"`);
      return { w: w.rows.map((x) => x.id), m: m.rows.map((x) => x.id), r: r.rows.map((x) => x.membership_id) };
    });
    assert.deepEqual(rows.w, [ids.wsA]);
    assert.deepEqual(rows.m, [ids.memA]);
    assert.deepEqual(rows.r, [ids.memA]);
  });

  await t.test("cross-workspace reads are blocked", async () => {
    // User A pins their own workspace and asks explicitly for B's rows.
    const rows = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) => {
      const w = await c.query(`SELECT "id" FROM "workspaces" WHERE "id" = $1`, [ids.wsB]);
      const m = await c.query(`SELECT "id" FROM "workspace_memberships" WHERE "workspace_id" = $1`, [
        ids.wsB,
      ]);
      const r = await c.query(`SELECT "membership_id" FROM "membership_roles" WHERE "membership_id" = $1`, [
        ids.memB,
      ]);
      return [w.rowCount, m.rowCount, r.rowCount];
    });
    assert.deepEqual(rows, [0, 0, 0]);
  });

  await t.test("pinning a workspace without membership reads nothing", async () => {
    // Defense in depth: the application must validate membership before SET
    // LOCAL, but a forged workspace id must not read that workspace either.
    const rows = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsB }, async (c) => {
      const w = await c.query(`SELECT "id" FROM "workspaces"`);
      return w.rowCount;
    });
    assert.equal(rows, 0);
  });

  await t.test("cross-workspace writes are blocked", async () => {
    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(
          `INSERT INTO "workspace_memberships" ("id","workspace_id","user_id","status") VALUES ($1,$2,$3,'ACTIVE')`,
          [`m-x-${randomUUID()}`, ids.wsB, ids.userA],
        ),
      ),
      "inserting a membership into another workspace",
    );

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`UPDATE "workspace_memberships" SET "workspace_id" = $1 WHERE "id" = $2`, [
          ids.wsB,
          ids.memA,
        ]),
      "moving a membership into another workspace",
    );

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`UPDATE "workspaces" SET "id" = $1 WHERE "id" = $2`, [
          `w-x-${randomUUID()}`,
          ids.wsA,
        ]),
      "updating a workspace row out of the pinned workspace",
    );
  });

  await t.test("updates to another workspace's rows affect nothing", async () => {
    // USING excludes the pre-image, so this is a silent no-op rather than an
    // error — assert the row is genuinely untouched.
    const affected = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) => {
      const res = await c.query(`UPDATE "workspace_memberships" SET "status" = 'REMOVED' WHERE "id" = $1`, [
        ids.memB,
      ]);
      return res.rowCount;
    });
    assert.equal(affected, 0);

    const { rows } = await owner.query(`SELECT "status" FROM "workspace_memberships" WHERE "id" = $1`, [
      ids.memB,
    ]);
    assert.equal(rows[0].status, "ACTIVE");
  });

  await t.test("deleting another workspace's rows affects nothing", async () => {
    const affected = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) => {
      const res = await c.query(`DELETE FROM "workspace_memberships" WHERE "id" = $1`, [ids.memB]);
      return res.rowCount;
    });
    assert.equal(affected, 0);

    const { rows } = await owner.query(`SELECT count(*)::int AS n FROM "workspace_memberships" WHERE "id" = $1`, [
      ids.memB,
    ]);
    assert.equal(rows[0].n, 1);
  });

  await t.test("role grants require a pinned workspace", async () => {
    // Without this, a member of any workspace could self-grant ORG_OWNER from an
    // unpinned (user-scoped) context.
    const ownerRoleId = (await owner.query(`SELECT "id" FROM "roles" WHERE "code" = 'ORG_OWNER'`))
      .rows[0].id as string;

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: null }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          ids.memA,
          ownerRoleId,
        ]),
      "granting a role with no workspace pinned",
    );

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          ids.memB,
          ownerRoleId,
        ]),
      "granting a role on another workspace's membership",
    );
  });

  await t.test("authorization catalogs are readable but not writable at runtime", async () => {
    const codes = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) => {
      const r = await c.query(`SELECT "code" FROM "roles" WHERE "code" = 'LEARNER'`);
      const p = await c.query(`SELECT "code" FROM "permissions" WHERE "code" = 'learn.access'`);
      const rp = await c.query(`SELECT count(*)::int AS n FROM "role_permissions"`);
      return { roles: r.rowCount, permissions: p.rowCount, mappings: rp.rows[0].n };
    });
    assert.equal(codes.roles, 1);
    assert.equal(codes.permissions, 1);
    assert.ok(codes.mappings > 0);

    await assert.rejects(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`INSERT INTO "permissions" ("id","code") VALUES ($1,$2)`, [randomUUID(), "evil.perm"]),
      ),
      /permission denied/i,
      "the runtime role must not be able to invent permissions",
    );
  });

  await t.test("platform role grants are self-read only and never runtime-writable", async () => {
    const superAdminId = (await owner.query(`SELECT "id" FROM "roles" WHERE "code" = 'SUPER_ADMIN'`))
      .rows[0].id as string;
    await owner.query(`INSERT INTO "user_platform_roles" ("user_id","role_id") VALUES ($1,$2)`, [
      ids.userB,
      superAdminId,
    ]);

    const visible = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) => {
      const res = await c.query(`SELECT "user_id" FROM "user_platform_roles"`);
      return res.rowCount;
    });
    assert.equal(visible, 0, "user A must not see user B's platform roles");

    await assert.rejects(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`INSERT INTO "user_platform_roles" ("user_id","role_id") VALUES ($1,$2)`, [
          ids.userA,
          superAdminId,
        ]),
      /permission denied/i,
      "the runtime role must not be able to grant itself SUPER_ADMIN",
    );
  });
});
