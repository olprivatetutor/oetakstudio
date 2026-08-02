import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { invoices, organizationMembers, subscriptionPlans, subscriptions } from "@/db/schema/learning";
import { AppError } from "@/lib/api/response";
import { createBillingProvider } from "@/lib/billing/factory";
import { canManageOrganization } from "@/lib/permissions";
import type { SubscriptionPlan } from "@/types/domain";

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

export async function applyStripeCheckoutCompleted(session: StripeCheckoutSession) {
  const subjectType = session.metadata?.subjectType;
  const subjectId = session.metadata?.subjectId;
  const plan = session.metadata?.plan as SubscriptionPlan | undefined;
  const interval = session.metadata?.interval;
  if (!subjectId || !plan || !["individual", "organization"].includes(subjectType ?? "")) {
    throw new AppError("VALIDATION_ERROR", "Stripe session metadata is incomplete", 400);
  }

  const [updated] = await db
    .update(subscriptions)
    .set({
      plan,
      status: "active",
      provider: "stripe",
      externalCustomerId: session.customer,
      externalSubscriptionId: session.subscription,
      billingInterval: interval === "annual" ? "annual" : "monthly",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(subscriptions.subjectType, subjectType as "individual" | "organization"),
        eq(subscriptions.subjectId, subjectId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Subscription record not found", 404);
  return updated;
}
