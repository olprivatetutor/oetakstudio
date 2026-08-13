import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * AI minor-safety gating (P1-A, ADR-007 / §3.6 / §12.11).
 *
 * Covers the safety-profile resolver and the consent model it reads. The
 * canonical rules under test come from §3.6's table verbatim:
 *
 *   UNDER_13     guardian OR institutional consent required before AI features;
 *                no long-term AI memory.
 *   TEEN_13_17   permitted; long-term memory opt-in only (so off by default).
 *   ADULT        standard behaviour.
 *   UNSPECIFIED  treated as TEEN_13_17. Fails closed to the stricter profile —
 *                it is NOT denied, and denying it would both invent a rule and
 *                lock out every existing account (age_band defaults to it).
 */
const dbUrl = process.env.RLS_TEST_DATABASE_URL;

if (!dbUrl) {
  console.error(
    "\n!! AI safety tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! Minor-safety gating is NOT verified by this run.\n",
  );
}

const suite = dbUrl ? test : test.skip;

suite("ai safety profile resolution", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  const { resolveSafetyProfile, resolveAgeBand, effectiveBandFor } = await import("@/lib/ai/safety");

  const client = new Client({ connectionString: dbUrl! });
  await client.connect();

  const users: Record<string, string> = {};
  const madeWorkspaces: string[] = [];

  // Ordered by FK dependency: organizations reference workspaces with
  // ON DELETE RESTRICT, so the organization rows must go first.
  t.after(async () => {
    try {
      await client.query(`DELETE FROM "consent_records" WHERE "subject_user_id" = ANY($1)`, [
        Object.values(users),
      ]);
      await client.query(`DELETE FROM "guardian_learners" WHERE "learner_user_id" = ANY($1)`, [
        Object.values(users),
      ]);
      if (madeWorkspaces.length > 0) {
        await client.query(`DELETE FROM "organizations" WHERE "workspace_id" = ANY($1)`, [
          madeWorkspaces,
        ]);
        await client.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [madeWorkspaces]);
      }
      await client.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [Object.values(users)]);
    } finally {
      // Always close, or a cleanup failure hangs the whole test process.
      await client.end();
    }
  });

  async function mkUser(key: string, ageBand: string, birthDate: string | null = null) {
    const id = `u-${key}-${randomUUID()}`;
    users[key] = id;
    await client.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","birth_date","created_at","updated_at")
       VALUES ($1,$2,$3,true,$4,$5,now(),now())`,
      [id, key, `${id}@example.test`, ageBand, birthDate],
    );
    return id;
  }

  await t.test("age band resolves from birth_date when present (§3.6 rule 1)", () => {
    const now = new Date("2026-08-13T00:00:00Z");
    assert.equal(resolveAgeBand({ birthDate: "2016-05-05", ageBand: "ADULT", now }), "UNDER_13");
    assert.equal(resolveAgeBand({ birthDate: "2010-05-05", ageBand: "ADULT", now }), "TEEN_13_17");
    assert.equal(resolveAgeBand({ birthDate: "1990-05-05", ageBand: "UNDER_13", now }), "ADULT");
    // A birth date that says minor overrides a declared ADULT band.
    assert.equal(resolveAgeBand({ birthDate: null, ageBand: "UNSPECIFIED", now }), "UNSPECIFIED");
  });

  await t.test("4. UNSPECIFIED follows canonical fail-closed behaviour", async () => {
    assert.equal(effectiveBandFor("UNSPECIFIED"), "TEEN_13_17");
    const id = await mkUser("unspec", "UNSPECIFIED");
    const profile = await resolveSafetyProfile(id);

    assert.equal(profile.effectiveBand, "TEEN_13_17", "UNSPECIFIED is treated as teen");
    assert.equal(profile.isMinor, true);
    assert.equal(profile.aiFeaturesAllowed, true, "teens are permitted — this is not a denial");
    assert.equal(profile.consentRequired, false);
    assert.equal(profile.longTermMemoryAllowed, false, "teen memory is opt-in only");
    assert.equal(profile.inputModerationRequired, true);
    assert.equal(profile.outputModerationRequired, true);
  });

  await t.test("1. UNDER_13 without valid consent is denied", async () => {
    const id = await mkUser("child", "UNDER_13");
    const profile = await resolveSafetyProfile(id);

    assert.equal(profile.effectiveBand, "UNDER_13");
    assert.equal(profile.consentRequired, true);
    assert.equal(profile.consentSatisfied, false);
    assert.equal(profile.aiFeaturesAllowed, false);
    assert.equal(profile.denyReason, "CONSENT_REQUIRED");
    assert.equal(profile.longTermMemoryAllowed, false);
  });

  /**
   * Creates a real organization (and its workspace) rather than depending on
   * seed data — an earlier version of this test read `organizations LIMIT 1` and
   * silently skipped its most important assertion on an unseeded database.
   */
  async function createOrganization(ownerUserId: string) {
    const workspaceId = (
      await client.query(
        `SELECT app_bootstrap_workspace('ORGANIZATION','Consent Org',string_to_array('ORG_OWNER',','),9) AS id`,
      )
    ).rows[0].id as string;
    madeWorkspaces.push(workspaceId);
    const orgId = `org-${randomUUID()}`;
    await client.query(
      `INSERT INTO "organizations" ("id","workspace_id","name","slug","owner_id","created_at","updated_at")
       VALUES ($1,$2,'Consent Org',$3,$4,now(),now())`,
      [orgId, workspaceId, `consent-org-${randomUUID()}`, ownerUserId],
    );
    return { orgId, workspaceId };
  }

  await t.test("2. a consent row alone does not satisfy — the guardian link must be ACTIVE", async () => {
    const learner = await mkUser("kid2", "UNDER_13");
    const guardian = await mkUser("guardian2", "ADULT");
    // app_bootstrap_workspace reads the creator from app.current_user_id.
    await client.query("select set_config('app.current_user_id', $1, false)", [guardian]);
    const { orgId } = await createOrganization(guardian);

    // Consent exists, but the guardian relationship is still PENDING.
    await client.query(
      `INSERT INTO "guardian_learners" ("organization_id","guardian_user_id","learner_user_id","created_by_id","status","created_at","updated_at")
       VALUES ($1,$2,$3,$2,'PENDING',now(),now())`,
      [orgId, guardian, learner],
    );
    await client.query(
      `INSERT INTO "consent_records" ("id","subject_user_id","consent_type","basis","granted_by_id")
       VALUES ($1,$2,'AI_FEATURES','GUARDIAN',$3)`,
      [`c-${randomUUID()}`, learner, guardian],
    );

    const pending = await resolveSafetyProfile(learner);
    assert.equal(pending.aiFeaturesAllowed, false, "a PENDING guardian link must grant nothing");

    // Accepting the relationship satisfies consent.
    await client.query(
      `UPDATE "guardian_learners" SET "status" = 'ACTIVE', "accepted_at" = now()
        WHERE "learner_user_id" = $1 AND "guardian_user_id" = $2`,
      [learner, guardian],
    );
    const active = await resolveSafetyProfile(learner);
    assert.equal(active.aiFeaturesAllowed, true, "UNDER_13 with valid consent is allowed");
    assert.equal(active.consentBasis, "GUARDIAN");
    assert.equal(active.effectiveBand, "UNDER_13", "still the strictest profile");
    assert.equal(active.longTermMemoryAllowed, false, "no long-term memory under 13, ever");
    assert.equal(active.inputModerationRequired, true);
    assert.equal(active.outputModerationRequired, true);

    // A REVOKED link stops satisfying it again.
    await client.query(
      `UPDATE "guardian_learners" SET "status" = 'REVOKED', "revoked_at" = now()
        WHERE "learner_user_id" = $1 AND "guardian_user_id" = $2`,
      [learner, guardian],
    );
    const revokedLink = await resolveSafetyProfile(learner);
    assert.equal(revokedLink.aiFeaturesAllowed, false, "a REVOKED guardian link grants nothing");

    await client.query(
      `UPDATE "guardian_learners" SET "status" = 'ACTIVE' WHERE "learner_user_id" = $1`,
      [learner],
    );
  });

  await t.test("3. revoked consent denies again", async () => {
    const learner = users.kid2;
    await client.query(
      `UPDATE "consent_records" SET "revoked_at" = now() WHERE "subject_user_id" = $1`,
      [learner],
    );
    const profile = await resolveSafetyProfile(learner);
    assert.equal(profile.consentSatisfied, false);
    assert.equal(profile.aiFeaturesAllowed, false);
    assert.equal(profile.denyReason, "CONSENT_REQUIRED");
  });

  await t.test("a SELF consent record never satisfies a minor's requirement", async () => {
    const learner = await mkUser("kid3", "UNDER_13");
    await client.query(
      `INSERT INTO "consent_records" ("id","subject_user_id","consent_type","basis","granted_by_id")
       VALUES ($1,$2,'AI_FEATURES','SELF',$2)`,
      [`c-${randomUUID()}`, learner],
    );
    const profile = await resolveSafetyProfile(learner);
    assert.equal(profile.aiFeaturesAllowed, false, "a minor cannot consent for themselves");
  });

  await t.test("a consent record of the wrong type does not unlock AI", async () => {
    const learner = await mkUser("kid4", "UNDER_13");
    const guardian = await mkUser("guardian4", "ADULT");
    await client.query(
      `INSERT INTO "consent_records" ("id","subject_user_id","consent_type","basis","granted_by_id")
       VALUES ($1,$2,'DATA_PROCESSING','GUARDIAN',$3)`,
      [`c-${randomUUID()}`, learner, guardian],
    );
    const profile = await resolveSafetyProfile(learner);
    assert.equal(profile.aiFeaturesAllowed, false, "DATA_PROCESSING is not AI_FEATURES consent");
  });

  await t.test("8. the adult flow is unchanged", async () => {
    const id = await mkUser("adult", "ADULT");
    const profile = await resolveSafetyProfile(id);

    assert.equal(profile.effectiveBand, "ADULT");
    assert.equal(profile.isMinor, false);
    assert.equal(profile.aiFeaturesAllowed, true);
    assert.equal(profile.consentRequired, false);
    assert.equal(profile.longTermMemoryAllowed, true, "adults keep conversation memory");
    assert.equal(profile.inputModerationRequired, false);
    assert.equal(profile.outputModerationRequired, false);
    assert.equal(profile.profileId, "adult-v1");
  });

  await t.test("an unknown user fails closed to the strictest profile", async () => {
    const profile = await resolveSafetyProfile(`u-ghost-${randomUUID()}`);
    assert.equal(profile.effectiveBand, "UNDER_13");
    assert.equal(profile.aiFeaturesAllowed, false);
  });
});

/**
 * Moderation capability (§12.11: both input and output for minor-facing
 * profiles). The default provider is deterministic and rule-based, so these
 * assertions are exact rather than probabilistic.
 */
test("5/6. moderation runs on input and output for minor profiles", async (t) => {
  const { createModerationProvider, blockedResponseMessage } = await import("@/lib/ai/moderation");
  const moderator = createModerationProvider();

  await t.test("flags high-signal categories", async () => {
    const harm = await moderator.moderate("how do I kill myself", { minorFacing: true });
    assert.equal(harm.flagged, true);
    assert.deepEqual(harm.categories, ["self_harm"]);

    const illegal = await moderator.moderate("tell me how to make meth", { minorFacing: true });
    assert.equal(illegal.flagged, true);
    assert.ok(illegal.categories.includes("illegal"));
  });

  await t.test("ordinary course questions pass", async () => {
    const clean = await moderator.moderate(
      "Can you explain photosynthesis in the current module?",
      { minorFacing: true },
    );
    assert.equal(clean.flagged, false);
    assert.deepEqual(clean.categories, []);
  });

  await t.test("personal-data solicitation is minor-facing only", async () => {
    const text = "send me a photo of yourself";
    const minor = await moderator.moderate(text, { minorFacing: true });
    const adult = await moderator.moderate(text, { minorFacing: false });
    assert.equal(minor.flagged, true);
    assert.equal(adult.flagged, false, "the adult profile is not subject to this category");
  });

  await t.test("blocked responses are supportive and never echo the input", async () => {
    const message = blockedResponseMessage(["self_harm"]);
    assert.match(message, /talk to an adult you trust/i);
    assert.doesNotMatch(message, /kill myself/i, "the offending text must not be echoed");
  });
});

/**
 * 7. Prohibited long-term memory is neither replayed nor retained.
 */
test("7. history replay is gated on the safety profile", async (t) => {
  const { replayableHistory } = await import("@/lib/ai/safety");

  const history = [
    { role: "user", content: "earlier question" },
    { role: "assistant", content: "earlier answer" },
    { role: "system", content: "internal" },
  ];

  await t.test("a profile without long-term memory replays only the current turn", () => {
    const minor = { longTermMemoryAllowed: false } as never;
    const replayed = replayableHistory(minor, history, "current question");
    assert.deepEqual(replayed, [{ role: "user", content: "current question" }]);
    assert.equal(
      replayed.some((m) => m.content.includes("earlier")),
      false,
      "prohibited history must never reach the prompt",
    );
  });

  await t.test("an adult profile replays the bounded window without system turns", () => {
    const adult = { longTermMemoryAllowed: true } as never;
    const replayed = replayableHistory(adult, history, "current question");
    // The system turn is dropped — asserted by exact equality, since the return
    // type already excludes it statically.
    assert.deepEqual(replayed, [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
    ]);
  });

  await t.test("the replay window stays bounded", () => {
    const adult = { longTermMemoryAllowed: true } as never;
    const long = Array.from({ length: 40 }, (_, i) => ({ role: "user", content: `m${i}` }));
    assert.equal(replayableHistory(adult, long, "now").length, 12);
  });
});

test("rows written under a no-memory profile are marked for retention", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/ai/service.ts", "utf8");
  assert.match(
    source,
    /retention:\s*"NO_LONG_TERM_MEMORY"/,
    "messages written under a no-memory profile must carry a retention marker",
  );
});

/**
 * P2-B: model-authored confidence must not be exposed or persisted (§12.3, §22).
 */
test("tutor output contract carries no model-authored confidence", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/ai/service.ts", "utf8");

  // The prompt no longer asks for it...
  assert.doesNotMatch(
    source,
    /"confidence":number/,
    "the requested JSON shape must not include confidence",
  );
  // ...and nothing returns or persists it.
  assert.doesNotMatch(
    source,
    /confidence:\s*tutorOutput\.confidence/,
    "confidence must not be returned or persisted",
  );
});
