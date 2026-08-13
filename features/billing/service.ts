import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  invoices,
  organizationMembers,
  paymentWebhookEvents,
  subscriptionPlans,
  subscriptions,
} from "@/db/schema/learning";
import { AppError } from "@/lib/api/response";
import { createBillingProvider } from "@/lib/billing/factory";
import { canManageOrganization } from "@/lib/permissions";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/types/domain";

type User = { id: string; email?: string | null };

async function assertSubscriptionAccess(
  currentUser: User,
  subjectType: "individual" | "organization",
  subjectId: string,
) {
  if (subjectType === "individual" && subjectId !== currentUser.id) {
    throw new AppError("FORBIDDEN", "You cannot manage another user's subscription", 403);
  }
  if (subjectType === "organization" && !(await canManageOrganization(currentUser.id, subjectId))) {
    throw new AppError("FORBIDDEN", "Organization owner or admin access is required", 403);
  }
}

export async function listBillingPlans() {
  return db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.monthlyPriceCents));
}

export async function getBillingOverview(currentUser: User) {
  const memberships = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, currentUser.id),
        eq(organizationMembers.status, "active"),
        inArray(organizationMembers.role, ["owner", "admin"]),
      ),
    );
  const subjectIds = [currentUser.id, ...memberships.map((row) => row.organizationId)];
  const subscriptionRows = await db
    .select()
    .from(subscriptions)
    .where(inArray(subscriptions.subjectId, subjectIds));
  const invoiceRows = subscriptionRows.length > 0
    ? await db
        .select()
        .from(invoices)
        .where(inArray(invoices.subscriptionId, subscriptionRows.map((row) => row.id)))
        .orderBy(asc(invoices.createdAt))
    : [];
  return { subscriptions: subscriptionRows, invoices: invoiceRows };
}

export async function startSubscriptionCheckout(
  currentUser: User,
  input: {
    subjectType: "individual" | "organization";
    subjectId: string;
    plan: Exclude<SubscriptionPlan, "free">;
    interval: "monthly" | "annual";
  },
) {
  await assertSubscriptionAccess(currentUser, input.subjectType, input.subjectId);
  if (!currentUser.email) throw new AppError("VALIDATION_ERROR", "A billing email is required", 400);
  if (input.plan === "enterprise") {
    throw new AppError("CONFLICT", "Enterprise subscriptions require a custom agreement", 409);
  }
  const provider = createBillingProvider();
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return provider.createCheckout({
    ...input,
    customerEmail: currentUser.email,
    successUrl: `${baseUrl}/dashboard/settings/billing?checkout=success`,
    cancelUrl: `${baseUrl}/dashboard/settings/billing?checkout=canceled`,
  });
}

type StripeCheckoutSession = {
  id: string;
  customer?: string;
  subscription?: string;
  payment_status?: string;
  metadata?: Record<string, string>;
};

/**
 * Checkout metadata is set by our own `createCheckout` and arrives over a
 * signature-verified channel, but it is still external input by the time it gets
 * here — a schema is what makes "we only ever set valid values" an enforced fact
 * rather than an assumption. Replaces the previous unchecked
 * `as SubscriptionPlan` cast, which would have written any string straight into
 * the plan column, and the `interval === "annual" ? ... : "monthly"` fallback,
 * which silently downgraded unrecognised intervals to monthly.
 */
const stripeCheckoutMetadataSchema = z.object({
  subjectType: z.enum(["individual", "organization"]),
  subjectId: z.string().min(1),
  plan: z.enum(SUBSCRIPTION_PLANS).exclude(["free"]),
  interval: z.enum(["monthly", "annual"]),
});

/**
 * Stripe payment states that represent settled money. `unpaid` covers async
 * payment methods whose funds have not cleared — those settle later via
 * `checkout.session.async_payment_succeeded`, a separate event with its own id,
 * so ignoring them here loses nothing. `no_payment_required` is a fully
 * discounted or trial checkout, which legitimately activates.
 */
const SETTLED_PAYMENT_STATES = new Set(["paid", "no_payment_required"]);

export type StripeCheckoutOutcome =
  | { applied: true; reason?: undefined }
  | { applied: false; reason: string };

export async function applyStripeCheckoutCompleted(
  session: StripeCheckoutSession,
): Promise<StripeCheckoutOutcome> {
  const parsed = stripeCheckoutMetadataSchema.safeParse(session.metadata ?? {});
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Stripe session metadata is incomplete or invalid", 400);
  }
  const { subjectType, subjectId, plan, interval } = parsed.data;

  // Never activate a plan for money that has not settled.
  if (!SETTLED_PAYMENT_STATES.has(session.payment_status ?? "")) {
    return { applied: false, reason: `payment_status=${session.payment_status ?? "unknown"}` };
  }

  const [updated] = await db
    .update(subscriptions)
    .set({
      plan,
      status: "active",
      provider: "stripe",
      externalCustomerId: session.customer,
      externalSubscriptionId: session.subscription,
      billingInterval: interval,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(subscriptions.subjectType, subjectType),
        eq(subscriptions.subjectId, subjectId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Subscription record not found", 404);
  return { applied: true };
}

/**
 * Claims a provider webhook delivery for processing, per §13.10
 * (`payment_webhook_events`).
 *
 * Deduplication is a state transition, not an existence check. The previous
 * `onConflictDoNothing` treated *any* prior row as a duplicate, so an event that
 * failed mid-processing was permanently swallowed: Stripe's retry saw the
 * `failed` row, got HTTP 200 "deduplicated", and stopped retrying — a paid
 * customer could be left on the old plan with no alerting. Only `processed` is
 * terminal now.
 *
 * Claimable states:
 *   * no row            — first delivery.
 *   * `failed`          — a previous attempt errored; retry it.
 *   * stale `received`  — a previous attempt died before recording an outcome
 *                         (crash, timeout, deploy). The lease window keeps a
 *                         concurrent redelivery of an *in-flight* event from
 *                         double-applying, since only one of the two racing
 *                         transactions can see a row older than the window.
 *   * `processed`/`ignored` — terminal; never reclaimed.
 *
 * Returns the post-claim `attemptCount` so callers can log or alert on repeats.
 */
const WEBHOOK_CLAIM_LEASE = "15 minutes";

export async function claimWebhookEvent(input: {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<{ claimed: boolean; attemptCount: number }> {
  const [claimed] = await db
    .insert(paymentWebhookEvents)
    .values({
      provider: input.provider,
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      payload: input.payload,
      status: "received",
    })
    .onConflictDoUpdate({
      target: [paymentWebhookEvents.provider, paymentWebhookEvents.providerEventId],
      set: {
        status: "received",
        eventType: input.eventType,
        payload: input.payload,
        attemptCount: sql`${paymentWebhookEvents.attemptCount} + 1`,
        lastError: null,
        updatedAt: new Date(),
      },
      setWhere: sql`${paymentWebhookEvents.status} = 'failed' OR (${paymentWebhookEvents.status} = 'received' AND ${paymentWebhookEvents.updatedAt} < now() - interval '${sql.raw(WEBHOOK_CLAIM_LEASE)}')`,
    })
    .returning({
      id: paymentWebhookEvents.id,
      attemptCount: paymentWebhookEvents.attemptCount,
    });
  return { claimed: Boolean(claimed), attemptCount: claimed?.attemptCount ?? 0 };
}

export async function markWebhookEventOutcome(
  provider: string,
  providerEventId: string,
  status: "processed" | "failed" | "ignored",
  error?: string,
) {
  await db
    .update(paymentWebhookEvents)
    .set({
      status,
      processedAt: new Date(),
      lastError: error ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.providerEventId, providerEventId),
      ),
    );
}
