import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Billing webhook idempotency and payment-state tests (§13.10, §23.1).
 *
 * Covers the two Phase 1 findings in the Stripe webhook path:
 *
 *   P1-3  `claimWebhookEvent` deduplicated on row existence, so an event that
 *         failed mid-processing was permanently swallowed — Stripe's retry got
 *         HTTP 200 "deduplicated" and stopped retrying, leaving a paying
 *         customer un-upgraded with no alert. Only `processed` may be terminal.
 *
 *   P2-3  `applyStripeCheckoutCompleted` never checked `payment_status` and
 *         cast `metadata.plan` straight into the plan column.
 *
 * The claim tests drive the real `payment_webhook_events` table because the
 * behaviour under test lives in the ON CONFLICT clause — an in-memory fake would
 * assert nothing about it. They need a migrated database and are skipped, loudly,
 * without one. Setup is identical to tests/workspace-rls.test.ts:
 *
 *   RLS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/oetak_rls_test \
 *     npm test
 */
const dbUrl = process.env.RLS_TEST_DATABASE_URL;

if (!dbUrl) {
  console.error(
    "\n!! Billing webhook integration tests SKIPPED: RLS_TEST_DATABASE_URL is not set.\n" +
      "!! Webhook retry semantics are NOT verified by this run.\n",
  );
}

const suite = dbUrl ? test : test.skip;

suite("stripe webhook idempotency", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  const { claimWebhookEvent, markWebhookEventOutcome } = await import("@/features/billing/service");

  const client = new Client({ connectionString: dbUrl! });
  await client.connect();
  const createdEventIds: string[] = [];

  t.after(async () => {
    if (createdEventIds.length > 0) {
      await client.query(`DELETE FROM "payment_webhook_events" WHERE "provider_event_id" = ANY($1)`, [
        createdEventIds,
      ]);
    }
    await client.end();
  });

  function newEvent() {
    const id = `evt_${randomUUID()}`;
    createdEventIds.push(id);
    return {
      provider: "stripe",
      providerEventId: id,
      eventType: "checkout.session.completed",
      payload: { id } as Record<string, unknown>,
    };
  }

  async function statusOf(providerEventId: string) {
    const { rows } = await client.query(
      `SELECT "status", "attempt_count" FROM "payment_webhook_events" WHERE "provider_event_id" = $1`,
      [providerEventId],
    );
    return rows[0] as { status: string; attempt_count: number };
  }

  await t.test("a first delivery is claimed", async () => {
    const event = newEvent();
    const claim = await claimWebhookEvent(event);
    assert.equal(claim.claimed, true);
    assert.equal(claim.attemptCount, 1);
  });

  await t.test("a successfully processed delivery is a terminal duplicate", async () => {
    const event = newEvent();
    assert.equal((await claimWebhookEvent(event)).claimed, true);
    await markWebhookEventOutcome("stripe", event.providerEventId, "processed");

    const redelivery = await claimWebhookEvent(event);
    assert.equal(redelivery.claimed, false, "a processed event must never be re-applied");
    assert.equal((await statusOf(event.providerEventId)).status, "processed");
  });

  await t.test(
    "P1-3 regression: first delivery fails, second retries and succeeds, attempt_count = 2",
    async () => {
      const event = newEvent();

      // Delivery 1: claimed, then processing throws — exactly what the route does.
      const first = await claimWebhookEvent(event);
      assert.equal(first.claimed, true);
      assert.equal(first.attemptCount, 1);
      await markWebhookEventOutcome(
        "stripe",
        event.providerEventId,
        "failed",
        "subscription row missing",
      );
      assert.equal((await statusOf(event.providerEventId)).status, "failed");

      // Delivery 2: Stripe retries. Before the fix this returned claimed=false
      // and the route replied 200 "deduplicated", losing the event forever.
      const second = await claimWebhookEvent(event);
      assert.equal(second.claimed, true, "a failed event must remain retryable");
      assert.equal(second.attemptCount, 2, "attempt_count must increment on reclaim");

      await markWebhookEventOutcome("stripe", event.providerEventId, "processed");
      const final = await statusOf(event.providerEventId);
      assert.equal(final.status, "processed");
      assert.equal(final.attempt_count, 2);

      // And it is terminal from here on.
      assert.equal((await claimWebhookEvent(event)).claimed, false);
      assert.equal((await statusOf(event.providerEventId)).attempt_count, 2);
    },
  );

  await t.test("an in-flight delivery is not double-claimed by a concurrent retry", async () => {
    // status stays `received` and the row is younger than the lease window, so a
    // redelivery arriving while the first is still processing must not claim it.
    const event = newEvent();
    assert.equal((await claimWebhookEvent(event)).claimed, true);
    const concurrent = await claimWebhookEvent(event);
    assert.equal(concurrent.claimed, false, "an in-flight event must not be double-applied");
    assert.equal((await statusOf(event.providerEventId)).attempt_count, 1);
  });

  await t.test("an event abandoned mid-flight is reclaimable after the lease expires", async () => {
    const event = newEvent();
    assert.equal((await claimWebhookEvent(event)).claimed, true);
    // Simulate a process that died before recording an outcome.
    await client.query(
      `UPDATE "payment_webhook_events" SET "updated_at" = now() - interval '1 hour' WHERE "provider_event_id" = $1`,
      [event.providerEventId],
    );
    const reclaim = await claimWebhookEvent(event);
    assert.equal(reclaim.claimed, true, "a stale received event must be reclaimable");
    assert.equal(reclaim.attemptCount, 2);
  });
});

/**
 * Payment-state and metadata validation (P2-3). These exercise
 * applyStripeCheckoutCompleted's guards, which run before any database write, so
 * they need no fixture rows — an unsettled or malformed session must be rejected
 * or ignored before it can touch the subscriptions table.
 */
suite("stripe checkout payment-state validation", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  const { applyStripeCheckoutCompleted } = await import("@/features/billing/service");

  const validMetadata = {
    subjectType: "individual",
    subjectId: "user-1",
    plan: "personal",
    interval: "monthly",
  };

  await t.test("an unpaid session never activates a plan", async () => {
    const outcome = await applyStripeCheckoutCompleted({
      id: "cs_test_unpaid",
      payment_status: "unpaid",
      metadata: validMetadata,
    });
    assert.equal(outcome.applied, false, "unpaid checkout must not activate a subscription");
    assert.match(outcome.reason ?? "", /payment_status=unpaid/);
  });

  await t.test("a session with no payment_status never activates a plan", async () => {
    const outcome = await applyStripeCheckoutCompleted({
      id: "cs_test_missing",
      metadata: validMetadata,
    });
    assert.equal(outcome.applied, false);
    assert.match(outcome.reason ?? "", /payment_status=unknown/);
  });

  await t.test("an unknown plan is rejected instead of written to the plan column", async () => {
    await assert.rejects(
      applyStripeCheckoutCompleted({
        id: "cs_test_badplan",
        payment_status: "paid",
        metadata: { ...validMetadata, plan: "enterprise-unlimited-free" },
      }),
      /metadata is incomplete or invalid/i,
    );
  });

  await t.test("the free plan cannot be activated through checkout", async () => {
    await assert.rejects(
      applyStripeCheckoutCompleted({
        id: "cs_test_free",
        payment_status: "paid",
        metadata: { ...validMetadata, plan: "free" },
      }),
      /metadata is incomplete or invalid/i,
    );
  });

  await t.test("an unsupported billing interval is rejected, not silently monthly", async () => {
    await assert.rejects(
      applyStripeCheckoutCompleted({
        id: "cs_test_interval",
        payment_status: "paid",
        metadata: { ...validMetadata, interval: "lifetime" },
      }),
      /metadata is incomplete or invalid/i,
    );
  });

  await t.test("an unknown subject type is rejected", async () => {
    await assert.rejects(
      applyStripeCheckoutCompleted({
        id: "cs_test_subject",
        payment_status: "paid",
        metadata: { ...validMetadata, subjectType: "platform" },
      }),
      /metadata is incomplete or invalid/i,
    );
  });
});

/**
 * NEW-6: delayed payment methods complete the Checkout session as `unpaid` and
 * settle later via `checkout.session.async_payment_succeeded`. Before this fix
 * only `checkout.session.completed` was handled, so those subscriptions never
 * activated at all. These drive the real subscription row so activation is
 * observed rather than inferred.
 */
suite("stripe delayed payment settlement", async (t) => {
  process.env.DATABASE_URL = dbUrl!;
  const { applyStripeCheckoutCompleted, claimWebhookEvent, markWebhookEventOutcome } = await import(
    "@/features/billing/service"
  );

  const client = new Client({ connectionString: dbUrl! });
  await client.connect();
  const subjectId = `u-async-${randomUUID()}`;
  const eventIds: string[] = [];

  t.after(async () => {
    await client.query(`DELETE FROM "subscriptions" WHERE "subject_id" = $1`, [subjectId]);
    if (eventIds.length > 0) {
      await client.query(
        `DELETE FROM "payment_webhook_events" WHERE "provider_event_id" = ANY($1)`,
        [eventIds],
      );
    }
    await client.end();
  });

  await client.query(
    `INSERT INTO "subscriptions" ("id","subject_type","subject_id","plan","status","seats","billing_interval","created_at","updated_at")
     VALUES ($1,'individual',$2,'free','trialing',1,'monthly',now(),now())`,
    [`sub-async-${randomUUID()}`, subjectId],
  );

  const session = {
    id: "cs_async_1",
    customer: "cus_async_1",
    subscription: "sub_async_1",
    metadata: {
      subjectType: "individual",
      subjectId,
      plan: "personal",
      interval: "annual",
    },
  };

  async function currentPlan() {
    const { rows } = await client.query(
      `SELECT "plan","status","billing_interval" FROM "subscriptions" WHERE "subject_id" = $1`,
      [subjectId],
    );
    return rows[0] as { plan: string; status: string; billing_interval: string };
  }

  await t.test("an unpaid completed session does not activate", async () => {
    const outcome = await applyStripeCheckoutCompleted({ ...session, payment_status: "unpaid" });
    assert.equal(outcome.applied, false);
    const plan = await currentPlan();
    assert.equal(plan.plan, "free", "plan must remain free while payment is unsettled");
    assert.equal(plan.status, "trialing");
  });

  await t.test("the later async_payment_succeeded settlement activates", async () => {
    // Same session, now paid — this is what Stripe delivers when funds clear.
    const outcome = await applyStripeCheckoutCompleted({ ...session, payment_status: "paid" });
    assert.equal(outcome.applied, true);
    const plan = await currentPlan();
    assert.equal(plan.plan, "personal");
    assert.equal(plan.status, "active");
    assert.equal(plan.billing_interval, "annual", "the validated interval must be honoured");
  });

  await t.test("a duplicate async success produces no second side effect", async () => {
    // Dedup is per provider_event_id: the settlement event is claimed once, and
    // a redelivery of that same event id is a terminal duplicate.
    const settlement = {
      provider: "stripe",
      providerEventId: `evt_async_${randomUUID()}`,
      eventType: "checkout.session.async_payment_succeeded",
      payload: {} as Record<string, unknown>,
    };
    eventIds.push(settlement.providerEventId);

    assert.equal((await claimWebhookEvent(settlement)).claimed, true);
    await markWebhookEventOutcome("stripe", settlement.providerEventId, "processed");

    const redelivery = await claimWebhookEvent(settlement);
    assert.equal(redelivery.claimed, false, "a processed settlement must not re-apply");

    // Re-applying the handler directly is idempotent too: same values, no drift.
    await applyStripeCheckoutCompleted({ ...session, payment_status: "paid" });
    const plan = await currentPlan();
    assert.equal(plan.plan, "personal");
    assert.equal(plan.status, "active");
    assert.equal(plan.billing_interval, "annual");
  });

  await t.test("an async payment failure leaves the plan un-activated", async () => {
    const failedSubject = `u-fail-${randomUUID()}`;
    await client.query(
      `INSERT INTO "subscriptions" ("id","subject_type","subject_id","plan","status","seats","billing_interval","created_at","updated_at")
       VALUES ($1,'individual',$2,'free','trialing',1,'monthly',now(),now())`,
      [`sub-fail-${randomUUID()}`, failedSubject],
    );
    const outcome = await applyStripeCheckoutCompleted({
      id: "cs_async_fail",
      payment_status: "unpaid",
      metadata: { ...session.metadata, subjectId: failedSubject },
    });
    assert.equal(outcome.applied, false);
    const { rows } = await client.query(
      `SELECT "plan" FROM "subscriptions" WHERE "subject_id" = $1`,
      [failedSubject],
    );
    assert.equal(rows[0].plan, "free");
    await client.query(`DELETE FROM "subscriptions" WHERE "subject_id" = $1`, [failedSubject]);
  });
});
