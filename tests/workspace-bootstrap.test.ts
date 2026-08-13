import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Application-level workspace bootstrap tests (§4.9 / ADR-020, NEW-5).
 *
 * The RLS suite proves what the database refuses. This proves what the
 * application service does with the transaction it is handed — specifically that
 * `provisionWorkspace` does not leak or silently replace the transaction-local
 * user/workspace context that unrelated work in the same transaction depends on.
 */
const dbUrl = process.env.RLS_TEST_DATABASE_URL;

if (!dbUrl) {
  console.error(
    "\n!! Workspace bootstrap tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! Bootstrap context handling is NOT verified by this run.\n",
  );
}

const suite = dbUrl ? test : test.skip;

suite("workspace bootstrap service", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  const { db } = await import("@/db");
  const { provisionWorkspace, canCreateOrganizationWorkspace, organizationWorkspaceLimit } =
    await import("@/lib/services/workspace");

  const client = new Client({ connectionString: dbUrl! });
  await client.connect();

  const creator = `u-boot-${randomUUID()}`;
  const outsider = `u-out-${randomUUID()}`;
  const created: string[] = [];

  t.after(async () => {
    if (created.length > 0) {
      await client.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [created]);
    }
    await client.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [[creator, outsider]]);
    await client.end();
  });

  for (const id of [creator, outsider]) {
    await client.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Boot',$2,true,'ADULT',now(),now())`,
      [id, `${id}@example.test`],
    );
  }

  // The permission arrives through a workspace role, so the creator needs a
  // personal workspace with LEARNER first — which is exactly how registration
  // bootstraps a real user.
  const personalId = await db.transaction(async (tx) => {
    const { workspace } = await provisionWorkspace(tx, {
      type: "PERSONAL",
      name: "Personal",
      ownerUserId: creator,
      roleCodes: ["LEARNER"],
    });
    return workspace.id;
  });
  created.push(personalId);

  await t.test("the permission gate reflects the role/permission union", async () => {
    const allowed = await db.transaction((tx) => canCreateOrganizationWorkspace(tx, creator));
    assert.equal(allowed, true, "LEARNER grants workspace.organization.create per §3.4");

    // A user with no membership at all holds no permissions.
    const denied = await db.transaction((tx) => canCreateOrganizationWorkspace(tx, outsider));
    assert.equal(denied, false, "a user with no active membership must hold no permission");
  });

  await t.test("a caller without the permission is refused before any write", async () => {
    const before = await client.query(`SELECT count(*)::int AS n FROM "workspaces"`);
    await assert.rejects(
      db.transaction((tx) =>
        provisionWorkspace(tx, {
          type: "ORGANIZATION",
          name: "Nope",
          ownerUserId: outsider,
          roleCodes: ["ORG_OWNER"],
        }),
      ),
      /workspace\.organization\.create permission is required/i,
    );
    const after = await client.query(`SELECT count(*)::int AS n FROM "workspaces"`);
    assert.equal(after.rows[0].n, before.rows[0].n, "a refused bootstrap must write nothing");
  });

  await t.test("NEW-5: bootstrap restores the surrounding transaction context", async () => {
    const outerUser = `u-outer-${randomUUID()}`;
    const outerWorkspace = `w-outer-${randomUUID()}`;

    const { sql } = await import("drizzle-orm");
    const observed = await db.transaction(async (tx) => {
      // Establish an unrelated context, as a workspace-scoped request would.
      await tx.execute(sql`select
          set_config('app.current_user_id', ${outerUser}, true),
          set_config('app.current_workspace_id', ${outerWorkspace}, true)`);

      const { workspace } = await provisionWorkspace(tx, {
        type: "ORGANIZATION",
        name: "Inner",
        ownerUserId: creator,
        roleCodes: ["ORG_OWNER"],
      });
      created.push(workspace.id);

      const after = (await tx.execute(sql`select
        coalesce(current_setting('app.current_user_id', true), '') as user_id,
        coalesce(current_setting('app.current_workspace_id', true), '') as workspace_id`)) as unknown as {
        rows: Array<{ user_id: string; workspace_id: string }>;
      };
      return after.rows[0];
    });

    assert.equal(observed.user_id, outerUser, "app.current_user_id must be restored");
    assert.equal(
      observed.workspace_id,
      outerWorkspace,
      "app.current_workspace_id must not be replaced by the new workspace",
    );
  });

  await t.test("bootstrap records creator lineage and a generated slug", async () => {
    const workspaceId = await db.transaction(async (tx) => {
      const { workspace, membership } = await provisionWorkspace(tx, {
        type: "ORGANIZATION",
        name: "Lineage",
        ownerUserId: creator,
        roleCodes: ["ORG_OWNER"],
      });
      assert.equal(membership.userId, creator);
      assert.equal(membership.status, "ACTIVE");
      assert.equal(workspace.createdById, creator);
      assert.match(workspace.slug, /^ws-[0-9a-f]{32}$/);
      return workspace.id;
    });
    created.push(workspaceId);
  });

  await t.test("§4.9 gates surface as typed errors, not opaque failures", async () => {
    // The function raises with distinct SQLSTATEs; the service must translate
    // them. Drizzle wraps driver errors, so this also guards the unwrapping —
    // without it every gate below degrades to a 500.
    const unverified = `u-unv-${randomUUID()}`;
    const child = `u-kid-${randomUUID()}`;
    await client.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Unverified',$2,false,'ADULT',now(),now()), ($3,'Child',$4,true,'UNDER_13',now(),now())`,
      [unverified, `${unverified}@example.test`, child, `${child}@example.test`],
    );

    // Both need the permission first, so give each a personal workspace.
    for (const id of [unverified, child]) {
      const ws = await db.transaction(async (tx) => {
        const { workspace } = await provisionWorkspace(tx, {
          type: "PERSONAL",
          name: "Personal",
          ownerUserId: id,
          roleCodes: ["LEARNER"],
        });
        return workspace.id;
      });
      created.push(ws);
    }

    await assert.rejects(
      db.transaction((tx) =>
        provisionWorkspace(tx, {
          type: "ORGANIZATION",
          name: "Unverified",
          ownerUserId: unverified,
          roleCodes: ["ORG_OWNER"],
        }),
      ),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "FORBIDDEN");
        assert.equal((error as { status?: number }).status, 403);
        assert.match((error as Error).message, /verified email/i);
        return true;
      },
    );

    await assert.rejects(
      db.transaction((tx) =>
        provisionWorkspace(tx, {
          type: "ORGANIZATION",
          name: "Child",
          ownerUserId: child,
          roleCodes: ["ORG_OWNER"],
        }),
      ),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "FORBIDDEN");
        assert.equal((error as { status?: number }).status, 403);
        assert.match((error as Error).message, /under 13/i);
        return true;
      },
    );

    await client.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [[unverified, child]]);
  });

  await t.test("the configured creation limit is surfaced as a rate-limit error", async () => {
    process.env.ORG_WORKSPACE_LIMIT_PER_USER = "1";
    try {
      assert.equal(organizationWorkspaceLimit(), 1);
      await assert.rejects(
        db.transaction((tx) =>
          provisionWorkspace(tx, {
            type: "ORGANIZATION",
            name: "OverLimit",
            ownerUserId: creator,
            roleCodes: ["ORG_OWNER"],
          }),
        ),
        /creation limit reached/i,
      );
    } finally {
      delete process.env.ORG_WORKSPACE_LIMIT_PER_USER;
    }
  });
});
