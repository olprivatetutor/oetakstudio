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

// A skipped security suite must never read as a pass. When RLS_TEST_DATABASE_URL
// is absent the suite still reports as skipped to node:test, but it says so
// loudly on stderr so CI output cannot be mistaken for "isolation verified".
// When the variable IS set, the suite must run — never silently degrade to skip.
if (!ownerUrl) {
  console.error(
    "\n!! RLS isolation tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! Workspace isolation is NOT verified by this run. See the header of\n" +
      "!! tests/workspace-rls.test.ts for the setup commands.\n",
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

  // Registered before the fixtures run: if a fixture throws, this connection
  // must still be closed or the test process hangs instead of reporting.
  t.after(async () => {
    await owner.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [[ids.wsA, ids.wsB]]);
    await owner.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [[ids.userA, ids.userB]]);
    await owner.end();
  });

  // ALTER ROLE does not accept bind parameters, so the literal is escaped and
  // inlined. RUNTIME_TEST_PASSWORD is a compile-time constant, not input.
  await owner.query(
    `ALTER ROLE app_rw WITH PASSWORD '${RUNTIME_TEST_PASSWORD.replace(/'/g, "''")}'`,
  );
  // `user` predates the workspace tables and has no database-side default for
  // created_at/updated_at (Drizzle fills them via $defaultFn in application
  // code), so raw SQL fixtures must set them or the insert fails with 23502.
  // userB carries a minor birth_date so the PII isolation tests have a subject.
  await owner.query(
    `INSERT INTO "user" ("id","name","email","email_verified","birth_date","age_band","created_at","updated_at")
     VALUES ($1,'A',$3,true,'1990-01-01','ADULT',now(),now()),
            ($2,'B',$4,true,'2016-05-05','UNDER_13',now(),now())`,
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
    // Covers all three tables — before 0013, memberships and membership_roles
    // trusted the pin alone and returned the victim workspace's full roster.
    const rows = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsB }, async (c) => {
      const w = await c.query(`SELECT "id" FROM "workspaces"`);
      const m = await c.query(`SELECT "id" FROM "workspace_memberships"`);
      const r = await c.query(`SELECT "membership_id" FROM "membership_roles"`);
      assert.equal(m.rowCount, 0, "pinning alone must not expose a roster");
      assert.equal(r.rowCount, 0, "pinning alone must not expose role grants");
      return w.rowCount;
    });
    assert.equal(rows, 0);
  });

  await t.test("P0-1 regression: the workspace takeover chain fails at step one", async () => {
    // Reproduces the exact chain from the Phase 1 security review against
    // 0012's `workspace_memberships_insert`, whose unpinned branch constrained
    // user_id but NOT workspace_id:
    //
    //   unpinned self-join into victim workspace -> victim workspace becomes
    //   visible -> pin it -> read the roster -> self-grant ORG_OWNER -> evict
    //   the legitimate owner -> mutate the workspace.
    //
    // The whole chain hinges on that first insert, so that is what must fail.
    const forgedMembership = `m-forged-${randomUUID()}`;

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: null }, (c) =>
        c.query(
          `INSERT INTO "workspace_memberships" ("id","workspace_id","user_id","status") VALUES ($1,$2,$3,'ACTIVE')`,
          [forgedMembership, ids.wsB, ids.userA],
        ),
      ),
      "unpinned self-join into a workspace the caller does not belong to",
    );

    // Nothing was written, so every later link in the chain has nothing to
    // stand on. Assert the post-conditions the attacker was aiming for.
    const { rows: forged } = await owner.query(
      `SELECT count(*)::int AS n FROM "workspace_memberships" WHERE "id" = $1`,
      [forgedMembership],
    );
    assert.equal(forged[0].n, 0, "no membership row may exist after the blocked insert");

    const visible = await asRuntime(url, { userId: ids.userA, workspaceId: null }, async (c) =>
      (await c.query(`SELECT "id" FROM "workspaces"`)).rows.map((r) => r.id),
    );
    assert.deepEqual(visible, [ids.wsA], "the victim workspace must not have become visible");

    // Pinning it anyway must still yield nothing, and self-granting ORG_OWNER
    // on the victim's own membership must be refused.
    const ownerRoleId = (await owner.query(`SELECT "id" FROM "roles" WHERE "code" = 'ORG_OWNER'`))
      .rows[0].id as string;
    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsB }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          ids.memB,
          ownerRoleId,
        ]),
      ),
      "self-granting ORG_OWNER in a workspace the caller merely pinned",
    );

    const evicted = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsB }, async (c) =>
      (await c.query(`UPDATE "workspace_memberships" SET "status" = 'REMOVED' WHERE "id" = $1`, [
        ids.memB,
      ])).rowCount,
    );
    assert.equal(evicted, 0, "the legitimate member must not be evictable");

    const renamed = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsB }, async (c) =>
      (await c.query(`UPDATE "workspaces" SET "name" = 'pwned' WHERE "id" = $1`, [ids.wsB])).rowCount,
    );
    assert.equal(renamed, 0, "the victim workspace must not be mutable");

    const { rows: after } = await owner.query(`SELECT "name" FROM "workspaces" WHERE "id" = $1`, [
      ids.wsB,
    ]);
    assert.equal(after[0].name, "B", "victim workspace state must be untouched");
  });

  await t.test("NEW-2: runtime code cannot insert a workspace directly", async () => {
    // 0014 removes both the policy and the privilege. This is what makes slug
    // squatting structurally impossible rather than merely rate-limited: there
    // is no route to a workspace row except app_bootstrap_workspace, which
    // generates the slug itself.
    await assert.rejects(
      asRuntime(url, { userId: ids.userA, workspaceId: null }, (c) =>
        c.query(
          `INSERT INTO "workspaces" ("id","type","name","slug") VALUES ($1,'ORGANIZATION','squat','org-acme-corp')`,
          [`w-squat-${randomUUID()}`],
        ),
      ),
      /permission denied/i,
      "the runtime role must not be able to create workspaces directly",
    );
  });

  await t.test("bootstrap creates workspace, membership and ORG_OWNER atomically", async () => {
    const workspaceId = await asRuntime(url, { userId: ids.userA, workspaceId: null }, async (c) =>
      (
        await c.query(
          `SELECT app_bootstrap_workspace('ORGANIZATION','Boot',string_to_array('ORG_OWNER',','),3) AS id`,
        )
      ).rows[0].id as string,
    );

    const { rows } = await owner.query(
      `SELECT w."created_by_id", w."slug", wm."user_id", wm."status", r."code"
         FROM "workspaces" w
         JOIN "workspace_memberships" wm ON wm."workspace_id" = w."id"
         JOIN "membership_roles" mr ON mr."membership_id" = wm."id"
         JOIN "roles" r ON r."id" = mr."role_id"
        WHERE w."id" = $1`,
      [workspaceId],
    );
    assert.equal(rows.length, 1, "bootstrap must create exactly one owner membership");
    assert.equal(rows[0].created_by_id, ids.userA, "creator lineage must be recorded");
    assert.equal(rows[0].user_id, ids.userA);
    assert.equal(rows[0].status, "ACTIVE");
    assert.equal(rows[0].code, "ORG_OWNER");
    assert.match(rows[0].slug, /^ws-[0-9a-f]{32}$/, "slug must be server-generated, not derived");

    await owner.query(`DELETE FROM "workspaces" WHERE "id" = $1`, [workspaceId]);
  });

  await t.test("bootstrap cannot be aimed at another user or a platform role", async () => {
    // The creator comes from app.current_user_id, never a parameter, so there is
    // no way to bootstrap on someone else's behalf.
    const workspaceId = await asRuntime(url, { userId: ids.userA, workspaceId: null }, async (c) =>
      (
        await c.query(
          `SELECT app_bootstrap_workspace('ORGANIZATION','Escalate',string_to_array('SUPER_ADMIN,ORG_OWNER',','),3) AS id`,
        )
      ).rows[0].id as string,
    );

    const { rows } = await owner.query(
      `SELECT r."code" FROM "workspace_memberships" wm
         JOIN "membership_roles" mr ON mr."membership_id" = wm."id"
         JOIN "roles" r ON r."id" = mr."role_id"
        WHERE wm."workspace_id" = $1`,
      [workspaceId],
    );
    const granted = rows.map((r) => r.code).sort();
    assert.deepEqual(granted, ["ORG_OWNER"], "a PLATFORM-scope role must never be granted");

    const { rows: members } = await owner.query(
      `SELECT "user_id" FROM "workspace_memberships" WHERE "workspace_id" = $1`,
      [workspaceId],
    );
    assert.deepEqual(members.map((m) => m.user_id), [ids.userA]);

    await owner.query(`DELETE FROM "workspaces" WHERE "id" = $1`, [workspaceId]);
  });

  await t.test("NEW-1 regression: an orphaned workspace cannot be taken over", async () => {
    // Both orphaning paths from the second security review. In each case the
    // workspace still exists and still holds tenant data, but has zero
    // memberships — the condition 0013's app_workspace_is_unclaimed treated as
    // "claim me".
    const ownerRoleId = (await owner.query(`SELECT "id" FROM "roles" WHERE "code" = 'ORG_OWNER'`))
      .rows[0].id as string;

    async function assertNotTakeoverable(workspaceId: string, label: string) {
      const remaining = await owner.query(
        `SELECT count(*)::int AS n FROM "workspace_memberships" WHERE "workspace_id" = $1`,
        [workspaceId],
      );
      assert.equal(remaining.rows[0].n, 0, `${label}: precondition — workspace must be orphaned`);

      // 1. cannot join
      await expectRlsViolation(
        asRuntime(url, { userId: ids.userA, workspaceId }, (c) =>
          c.query(
            `INSERT INTO "workspace_memberships" ("id","workspace_id","user_id","status") VALUES ($1,$2,$3,'ACTIVE')`,
            [`m-take-${randomUUID()}`, workspaceId, ids.userA],
          ),
        ),
        `${label}: joining an orphaned workspace`,
      );
      // ...including from an unpinned context.
      await expectRlsViolation(
        asRuntime(url, { userId: ids.userA, workspaceId: null }, (c) =>
          c.query(
            `INSERT INTO "workspace_memberships" ("id","workspace_id","user_id","status") VALUES ($1,$2,$3,'ACTIVE')`,
            [`m-take2-${randomUUID()}`, workspaceId, ids.userA],
          ),
        ),
        `${label}: joining an orphaned workspace unpinned`,
      );

      // 2. cannot grant themselves a role (no membership row exists to hang one on,
      //    but assert the policy refuses even a fabricated membership id).
      await expectRlsViolation(
        asRuntime(url, { userId: ids.userA, workspaceId }, (c) =>
          c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
            `m-take-${randomUUID()}`,
            ownerRoleId,
          ]),
        ),
        `${label}: granting a role in an orphaned workspace`,
      );

      // 3. cannot mutate the workspace
      const mutated = await asRuntime(url, { userId: ids.userA, workspaceId }, async (c) =>
        (await c.query(`UPDATE "workspaces" SET "name" = 'pwned' WHERE "id" = $1`, [workspaceId]))
          .rowCount,
      );
      assert.equal(mutated, 0, `${label}: orphaned workspace must not be mutable`);

      // 4. and it stays invisible
      const visible = await asRuntime(url, { userId: ids.userA, workspaceId }, async (c) =>
        (await c.query(`SELECT "id" FROM "workspaces"`)).rowCount,
      );
      assert.equal(visible, 0, `${label}: orphaned workspace must not be readable`);
    }

    // Path 1: the last member deletes their own membership.
    const leaver = `u-leave-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Leaver',$2,true,'ADULT',now(),now())`,
      [leaver, `${leaver}@example.test`],
    );
    const wsLeft = await asRuntime(url, { userId: leaver, workspaceId: null }, async (c) =>
      (
        await c.query(
          `SELECT app_bootstrap_workspace('ORGANIZATION','Left',string_to_array('ORG_OWNER',','),3) AS id`,
        )
      ).rows[0].id as string,
    );
    const leftMembership = (
      await owner.query(`SELECT "id" FROM "workspace_memberships" WHERE "workspace_id" = $1`, [
        wsLeft,
      ])
    ).rows[0].id as string;
    const removed = await asRuntime(url, { userId: leaver, workspaceId: wsLeft }, async (c) =>
      (await c.query(`DELETE FROM "workspace_memberships" WHERE "id" = $1`, [leftMembership]))
        .rowCount,
    );
    assert.equal(removed, 1, "the last member can still leave — that is not what we are fixing");
    await assertNotTakeoverable(wsLeft, "last member left");

    // Path 2: the last member's user account is deleted and the membership cascades.
    const doomed = `u-doomed-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Doomed',$2,true,'ADULT',now(),now())`,
      [doomed, `${doomed}@example.test`],
    );
    const wsCascade = await asRuntime(url, { userId: doomed, workspaceId: null }, async (c) =>
      (
        await c.query(
          `SELECT app_bootstrap_workspace('ORGANIZATION','Cascade',string_to_array('ORG_OWNER',','),3) AS id`,
        )
      ).rows[0].id as string,
    );
    await owner.query(`DELETE FROM "user" WHERE "id" = $1`, [doomed]);
    await assertNotTakeoverable(wsCascade, "owner account deleted");

    // The original creator does not automatically regain access either: there is
    // no recovery flow yet, and emptiness must never be an implicit grant.
    await expectRlsViolation(
      asRuntime(url, { userId: leaver, workspaceId: wsLeft }, (c) =>
        c.query(
          `INSERT INTO "workspace_memberships" ("id","workspace_id","user_id","status") VALUES ($1,$2,$3,'ACTIVE')`,
          [`m-recover-${randomUUID()}`, wsLeft, leaver],
        ),
      ),
      "the original creator re-joining an emptied workspace",
    );

    await owner.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [[wsLeft, wsCascade]]);
    await owner.query(`DELETE FROM "user" WHERE "id" = $1`, [leaver]);
  });

  await t.test("§4.9 gates: verification, age band, and creation limit", async () => {
    async function bootstrapAs(userId: string, limit = 3) {
      return asRuntime(url, { userId, workspaceId: null }, async (c) =>
        (
          await c.query(
            `SELECT app_bootstrap_workspace('ORGANIZATION','Gated',string_to_array('ORG_OWNER',','),$1) AS id`,
            [limit],
          )
        ).rows[0].id as string,
      );
    }

    // Unverified email cannot create an organization workspace.
    const unverified = `u-unver-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Unverified',$2,false,'ADULT',now(),now())`,
      [unverified, `${unverified}@example.test`],
    );
    await assert.rejects(bootstrapAs(unverified), /email is not verified/i);

    // UNDER_13 cannot, even when verified.
    const child = `u-child-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Child',$2,true,'UNDER_13',now(),now())`,
      [child, `${child}@example.test`],
    );
    await assert.rejects(bootstrapAs(child), /under 13/i);

    // A PERSONAL workspace is still allowed for a minor — §4.9 restricts
    // organization creation only.
    const personal = await asRuntime(url, { userId: child, workspaceId: null }, async (c) =>
      (
        await c.query(
          `SELECT app_bootstrap_workspace('PERSONAL','My Space',string_to_array('LEARNER',','),3) AS id`,
        )
      ).rows[0].id as string,
    );
    assert.ok(personal, "a minor must still get a personal workspace");

    // Creation limit is enforced inside the function, so it cannot be raced.
    const prolific = `u-many-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Prolific',$2,true,'ADULT',now(),now())`,
      [prolific, `${prolific}@example.test`],
    );
    const madeIds: string[] = [];
    for (let i = 0; i < 2; i++) madeIds.push(await bootstrapAs(prolific, 2));
    await assert.rejects(bootstrapAs(prolific, 2), /WORKSPACE_LIMIT_EXCEEDED/);

    await owner.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [[...madeIds, personal]]);
    await owner.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [
      [unverified, child, prolific],
    ]);
  });

  await t.test("an unauthenticated context cannot bootstrap at all", async () => {
    await assert.rejects(
      asRuntime(url, {}, (c) =>
        c.query(
          `SELECT app_bootstrap_workspace('ORGANIZATION','NoAuth',string_to_array('ORG_OWNER',','),3)`,
        ),
      ),
      /no authenticated user context/i,
    );
  });

  await t.test("P1-4: user PII is not readable across workspaces", async () => {
    // 0012 granted blanket SELECT on "user" with no RLS, so any workspace
    // context could read every user's birth_date and age_band.
    await assert.rejects(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`SELECT "birth_date" FROM "user" WHERE "id" = $1`, [ids.userB]),
      ),
      /permission denied/i,
      "birth_date must not be selectable by the runtime role at all",
    );

    await assert.rejects(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`SELECT "age_band" FROM "user" WHERE "id" = $1`, [ids.userB]),
      ),
      /permission denied/i,
      "age_band must go through the privileged safety-profile path",
    );

    // Even the granted columns must not expose an unrelated tenant's users.
    const leaked = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) =>
      (await c.query(`SELECT "id" FROM "user" WHERE "id" = $1`, [ids.userB])).rowCount,
    );
    assert.equal(leaked, 0, "a user in another workspace must not be readable");

    // Self is always readable, and so are co-members of the pinned workspace.
    const self = await asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, async (c) =>
      (await c.query(`SELECT "id","name","email" FROM "user" WHERE "id" = $1`, [ids.userA])).rowCount,
    );
    assert.equal(self, 1, "a caller must be able to read their own user row");
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
      ),
      "moving a membership into another workspace",
    );

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`UPDATE "workspaces" SET "id" = $1 WHERE "id" = $2`, [
          `w-x-${randomUUID()}`,
          ids.wsA,
        ]),
      ),
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
      ),
      "granting a role with no workspace pinned",
    );

    await expectRlsViolation(
      asRuntime(url, { userId: ids.userA, workspaceId: ids.wsA }, (c) =>
        c.query(`INSERT INTO "membership_roles" ("membership_id","role_id") VALUES ($1,$2)`, [
          ids.memB,
          ownerRoleId,
        ]),
      ),
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
      ),
      /permission denied/i,
      "the runtime role must not be able to grant itself SUPER_ADMIN",
    );
  });
});
