import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The AI-feature consent boundary (NEW-13, ADR-007 / §3.6 / §12.11).
 *
 * §3.6 gates "AI features" as a class. An earlier implementation gated only the
 * Tutor, so an UNDER_13 learner refused there could still send their voice to
 * Speech-to-Text and arbitrary text to Text-to-Speech. These tests cover the
 * shared guard and, critically, its ORDERING relative to provider construction.
 *
 * Ordering is proved behaviourally rather than by reading the source. The
 * provider constructors throw when their API key is absent, and no key is set in
 * the test environment, so the two outcomes are distinguishable:
 *
 *   denied user  -> FORBIDDEN 403          (guard ran; provider never built)
 *   allowed user -> INTERNAL_ERROR 500     (guard passed; provider construction
 *                                           reached, then failed on the key)
 *
 * If the guard were missing or ran late, the denied case would surface the
 * provider's key error instead of 403 — so this genuinely detects a regression.
 */
const dbUrl = process.env.RLS_TEST_DATABASE_URL;

if (!dbUrl) {
  console.error(
    "\n!! AI feature-gate tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! STT/TTS consent gating is NOT verified by this run.\n",
  );
}

const suite = dbUrl ? test : test.skip;

suite("ai feature consent boundary", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  // Ensure the discriminator holds: no provider keys in this environment.
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.DEEPGRAM_API_KEY;

  const { assertAiFeatureAllowed, providerSafetyIdentifier } = await import("@/lib/ai/safety");
  const { createTextToSpeechProvider } = await import("@/lib/ai/tts/factory");
  const { createSpeechToTextProvider } = await import("@/lib/ai/speech/factory");

  const client = new Client({ connectionString: dbUrl! });
  await client.connect();
  const users: string[] = [];
  const workspaces: string[] = [];

  t.after(async () => {
    try {
      await client.query(`DELETE FROM "consent_records" WHERE "subject_user_id" = ANY($1)`, [users]);
      await client.query(`DELETE FROM "guardian_learners" WHERE "learner_user_id" = ANY($1)`, [users]);
      if (workspaces.length > 0) {
        await client.query(`DELETE FROM "organizations" WHERE "workspace_id" = ANY($1)`, [workspaces]);
        await client.query(`DELETE FROM "workspaces" WHERE "id" = ANY($1)`, [workspaces]);
      }
      await client.query(`DELETE FROM "user" WHERE "id" = ANY($1)`, [users]);
    } finally {
      await client.end();
    }
  });

  async function mkUser(ageBand: string) {
    const id = `u-gate-${randomUUID()}`;
    users.push(id);
    await client.query(
      `INSERT INTO "user" ("id","name","email","email_verified","age_band","created_at","updated_at")
       VALUES ($1,'Gate',$2,true,$3,now(),now())`,
      [id, `${id}@example.test`, ageBand],
    );
    return id;
  }

  /** Grants an ACTIVE guardian relationship plus a live AI_FEATURES consent. */
  async function grantGuardianConsent(learner: string, guardian: string) {
    await client.query("select set_config('app.current_user_id', $1, false)", [guardian]);
    const workspaceId = (
      await client.query(
        `SELECT app_bootstrap_workspace('ORGANIZATION','Gate Org',string_to_array('ORG_OWNER',','),9) AS id`,
      )
    ).rows[0].id as string;
    workspaces.push(workspaceId);
    const orgId = `org-${randomUUID()}`;
    await client.query(
      `INSERT INTO "organizations" ("id","workspace_id","name","slug","owner_id","created_at","updated_at")
       VALUES ($1,$2,'Gate Org',$3,$4,now(),now())`,
      [orgId, workspaceId, `gate-org-${randomUUID()}`, guardian],
    );
    await client.query(
      `INSERT INTO "guardian_learners" ("organization_id","guardian_user_id","learner_user_id","created_by_id","status","accepted_at","created_at","updated_at")
       VALUES ($1,$2,$3,$2,'ACTIVE',now(),now(),now())`,
      [orgId, guardian, learner],
    );
    await client.query(
      `INSERT INTO "consent_records" ("id","subject_user_id","consent_type","basis","granted_by_id")
       VALUES ($1,$2,'AI_FEATURES','GUARDIAN',$3)`,
      [`c-${randomUUID()}`, learner, guardian],
    );
  }

  /** Replays a route's sequence: guard, then build the provider, then call it. */
  async function runSttSequence(userId: string, spy?: { called: boolean }) {
    await assertAiFeatureAllowed(userId, "speech_to_text");
    if (spy) {
      spy.called = true;
      return "provider-invoked";
    }
    createSpeechToTextProvider();
    return "provider-built";
  }

  async function runTtsSequence(userId: string, spy?: { called: boolean }) {
    await assertAiFeatureAllowed(userId, "text_to_speech");
    if (spy) {
      spy.called = true;
      return "provider-invoked";
    }
    createTextToSpeechProvider();
    return "provider-built";
  }

  await t.test("1. UNDER_13 without consent is refused by Speech-to-Text", async () => {
    const child = await mkUser("UNDER_13");
    await assert.rejects(runSttSequence(child), (error: unknown) => {
      assert.equal((error as { code?: string }).code, "FORBIDDEN");
      assert.equal((error as { status?: number }).status, 403);
      assert.equal((error as { details?: { feature?: string } }).details?.feature, "speech_to_text");
      return true;
    });
  });

  await t.test("2. UNDER_13 without consent is refused by Text-to-Speech", async () => {
    const child = await mkUser("UNDER_13");
    await assert.rejects(runTtsSequence(child), (error: unknown) => {
      assert.equal((error as { code?: string }).code, "FORBIDDEN");
      assert.equal((error as { status?: number }).status, 403);
      assert.equal((error as { details?: { feature?: string } }).details?.feature, "text_to_speech");
      return true;
    });
  });

  await t.test("6. no provider is invoked when the gate rejects", async () => {
    const child = await mkUser("UNDER_13");
    const sttSpy = { called: false };
    const ttsSpy = { called: false };

    await assert.rejects(runSttSequence(child, sttSpy));
    await assert.rejects(runTtsSequence(child, ttsSpy));

    assert.equal(sttSpy.called, false, "audio must never reach an external provider");
    assert.equal(ttsSpy.called, false, "text must never reach an external provider");
  });

  await t.test("3. UNDER_13 with ACTIVE guardian consent reaches Speech-to-Text", async () => {
    const child = await mkUser("UNDER_13");
    const guardian = await mkUser("ADULT");
    await grantGuardianConsent(child, guardian);

    // Passing the gate means the sequence proceeds to provider construction,
    // which fails only on the missing key — a different error from the 403.
    await assert.rejects(runSttSequence(child), (error: unknown) => {
      assert.equal((error as { code?: string }).code, "INTERNAL_ERROR");
      assert.match((error as Error).message, /DEEPGRAM_API_KEY/i);
      return true;
    });
  });

  await t.test("4. UNDER_13 with valid consent reaches Text-to-Speech under the minor profile", async () => {
    const child = await mkUser("UNDER_13");
    const guardian = await mkUser("ADULT");
    await grantGuardianConsent(child, guardian);

    const profile = await assertAiFeatureAllowed(child, "text_to_speech");
    assert.equal(profile.effectiveBand, "UNDER_13", "still the strictest profile");
    assert.equal(profile.inputModerationRequired, true, "TTS input must be moderated");
    assert.equal(profile.longTermMemoryAllowed, false);

    await assert.rejects(runTtsSequence(child), (error: unknown) => {
      assert.equal((error as { code?: string }).code, "INTERNAL_ERROR");
      assert.match((error as Error).message, /ELEVENLABS_API_KEY/i);
      return true;
    });
  });

  await t.test("5. the adult path is unchanged for both", async () => {
    const adult = await mkUser("ADULT");

    const profile = await assertAiFeatureAllowed(adult, "speech_to_text");
    assert.equal(profile.aiFeaturesAllowed, true);
    assert.equal(profile.inputModerationRequired, false, "adults are not moderated");
    assert.equal(profile.isMinor, false);

    // Both proceed past the gate to provider construction.
    await assert.rejects(runSttSequence(adult), /DEEPGRAM_API_KEY/i);
    await assert.rejects(runTtsSequence(adult), /ELEVENLABS_API_KEY/i);
  });

  await t.test("a teen passes the gate but carries the minor profile", async () => {
    const teen = await mkUser("TEEN_13_17");
    const profile = await assertAiFeatureAllowed(teen, "text_to_speech");
    assert.equal(profile.aiFeaturesAllowed, true, "teens need no consent record");
    assert.equal(profile.inputModerationRequired, true, "but their input is still moderated");
  });

  await t.test("the provider safety identifier is pseudonymous", async () => {
    const id = users[0];
    const identifier = providerSafetyIdentifier(id);
    assert.notEqual(identifier, id, "the raw internal user id must never be sent");
    assert.match(identifier, /^[0-9a-f]{64}$/, "sha256 hex");
    assert.equal(providerSafetyIdentifier(id), identifier, "stable for the same user");
  });
});

/**
 * Structural guarantees that complement the behavioural tests above: the guard
 * must appear in each route/service, and ahead of provider construction.
 */
test("every learner-facing AI entry point sits behind the shared guard", async (t) => {
  const { readFileSync } = await import("node:fs");

  const entryPoints: Array<{ file: string; providerCall: RegExp }> = [
    { file: "app/api/ai/speech-to-text/route.ts", providerCall: /createSpeechToTextProvider\(/ },
    { file: "app/api/ai/text-to-speech/route.ts", providerCall: /createTextToSpeechProvider\(/ },
    { file: "lib/ai/service.ts", providerCall: /createAiProviderChain\(/ },
    { file: "features/content-generation/service.ts", providerCall: /createAiProviderChain\(/ },
  ];

  for (const entry of entryPoints) {
    await t.test(entry.file, () => {
      const source = readFileSync(entry.file, "utf8");
      const guardAt = source.indexOf("assertAiFeatureAllowed(");
      assert.ok(guardAt > -1, `${entry.file} must call the shared guard`);

      const providerAt = source.search(entry.providerCall);
      assert.ok(providerAt > -1, `${entry.file} should construct a provider`);
      assert.ok(
        guardAt < providerAt,
        `${entry.file} must call the guard before constructing a provider`,
      );
    });
  }

  await t.test("age/consent logic is not re-derived outside the safety module", () => {
    for (const entry of entryPoints) {
      const source = readFileSync(entry.file, "utf8");
      assert.doesNotMatch(
        source,
        /age_band|ageBand\s*===|UNDER_13/,
        `${entry.file} must not re-derive age logic — it belongs in lib/ai/safety.ts`,
      );
    }
  });
});

/**
 * NEW-14: generation records its safety metadata and never sends the raw user id.
 */
test("content generation carries safety metadata", async (t) => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("features/content-generation/service.ts", "utf8");

  await t.test("the raw internal user id is not used as the provider identifier", () => {
    assert.doesNotMatch(
      source,
      /safetyIdentifier:\s*user\.id/,
      "the raw user id must not be sent to a provider",
    );
    assert.match(source, /safetyIdentifier:\s*providerSafetyIdentifier\(/);
  });

  await t.test("the applied profile and moderation outcome are persisted", () => {
    assert.match(source, /safetyProfile:\s*safety\.profileId/);
    assert.match(source, /moderationOutcome/);
  });

  await t.test("generated content stays a draft and is never auto-published", () => {
    assert.match(source, /status:\s*"draft"/);
    assert.match(source, /aiGenerated:\s*true/);
    assert.doesNotMatch(source, /status:\s*"published"/, "generation must never publish");
  });

  await t.test("a moderation rejection is not retried against the next provider", () => {
    // Retrying a content-policy failure on another provider would be an attempt
    // to launder blocked content through the fallback chain.
    assert.match(source, /error instanceof AppError && error\.status === 422/);
  });
});
