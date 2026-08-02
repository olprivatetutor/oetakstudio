import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  aiConversations,
  appAdmins,
  assessmentSubmissions,
  auditLogs,
  certificates,
  courseModules,
  courses,
  enrollments,
  learnerProfiles,
  organizationMembers,
  organizations,
  subscriptions,
  type subscriptionPlanEnum,
  type subscriptionStatusEnum,
} from "@/db/schema/learning";
import { AppError } from "@/lib/api/response";

export type AppAdminUser = {
  id: string;
  email: string;
  name?: string | null;
};

type SubscriptionPlan = (typeof subscriptionPlanEnum.enumValues)[number];
type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];

export const planCatalog: Record<SubscriptionPlan, { label: string; monthlyCents: number; seats: string; focus: string }> = {
  free: { label: "Free", monthlyCents: 0, seats: "1 learner", focus: "Evaluation and personal trial" },
  personal: { label: "Personal", monthlyCents: 1900, seats: "1 learner", focus: "Independent learning and certifications" },
  team: { label: "Team", monthlyCents: 9900, seats: "Up to 10 seats", focus: "Small learning teams" },
  professional: { label: "Professional", monthlyCents: 29900, seats: "Up to 50 seats", focus: "Growing learning programs" },
  enterprise: { label: "Enterprise", monthlyCents: 0, seats: "Custom seats", focus: "SSO and white-label operations" },
  school: { label: "School", monthlyCents: 49900, seats: "Up to 200 students", focus: "Curricula and guardian access" },
  university: { label: "University", monthlyCents: 99900, seats: "Up to 1,000 students", focus: "Advanced analytics and API access" },
};

function monthlyCentsForPlan(plan: SubscriptionPlan | null) {
  return plan ? planCatalog[plan].monthlyCents : 0;
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function getAppAdmin(userId: string) {
  const [admin] = await db
    .select()
    .from(appAdmins)
    .where(and(eq(appAdmins.userId, userId), eq(appAdmins.status, "active")))
    .limit(1);

  return admin ?? null;
}

export async function requireAppAdmin(currentUser: AppAdminUser) {
  const admin = await getAppAdmin(currentUser.id);

  if (!admin) {
    throw new AppError(
      "FORBIDDEN",
      "Application owner access is required",
      403,
    );
  }

  return admin;
}

export async function requirePlatformContentAccess(currentUser: AppAdminUser) {
  const admin = await requireAppAdmin(currentUser);

  if (!["owner", "content"].includes(admin.role)) {
    throw new AppError(
      "FORBIDDEN",
      "Platform content access is required",
      403,
    );
  }

  return admin;
}

async function getStats() {
  const [tenantCount] = await db.select({ value: count() }).from(organizations);
  const [learnerCount] = await db.select({ value: count() }).from(learnerProfiles);
  const [activeSubscriptions] = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));
  const [trialSubscriptions] = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "trialing"));
  const [courseCount] = await db.select({ value: count() }).from(courses);
  const [enrollmentCount] = await db.select({ value: count() }).from(enrollments);
  const [certificateCount] = await db.select({ value: count() }).from(certificates);
  const [submissionCount] = await db.select({ value: count() }).from(assessmentSubmissions);

  const subscriptionRows = await db.select({ plan: subscriptions.plan, status: subscriptions.status }).from(subscriptions);
  const monthlyRecurringCents = subscriptionRows
    .filter((row) => row.status === "active" || row.status === "trialing")
    .reduce((sum, row) => sum + monthlyCentsForPlan(row.plan), 0);

  return {
    tenants: tenantCount.value,
    learners: learnerCount.value,
    activeSubscriptions: activeSubscriptions.value,
    trialSubscriptions: trialSubscriptions.value,
    courses: courseCount.value,
    enrollments: enrollmentCount.value,
    certificates: certificateCount.value,
    submissions: submissionCount.value,
    monthlyRecurringCents,
  };
}

export async function getTenantSubscriptions() {
  return db
    .select({
      subscriptionId: subscriptions.id,
      plan: subscriptions.plan,
      status: subscriptions.status,
      seats: subscriptions.seats,
      billingEmail: subscriptions.billingEmail,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      notes: subscriptions.notes,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      organizationPlan: organizations.plan,
      memberCount: sql<number>`count(distinct ${organizationMembers.userId})::int`,
      courseCount: sql<number>`count(distinct ${courses.id})::int`,
    })
    .from(organizations)
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.subjectType, "organization"),
        eq(subscriptions.subjectId, organizations.id),
      ),
    )
    .leftJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
    .leftJoin(courses, eq(courses.organizationId, organizations.id))
    .groupBy(organizations.id, subscriptions.id)
    .orderBy(desc(organizations.createdAt));
}

export async function getIndividualSubscriptions() {
  return db
    .select({
      subscriptionId: subscriptions.id,
      plan: subscriptions.plan,
      status: subscriptions.status,
      seats: subscriptions.seats,
      billingEmail: subscriptions.billingEmail,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      notes: subscriptions.notes,
      userId: user.id,
      name: user.name,
      email: user.email,
      headline: learnerProfiles.headline,
      enrollmentCount: sql<number>`count(distinct ${enrollments.id})::int`,
      certificateCount: sql<number>`count(distinct ${certificates.id})::int`,
    })
    .from(learnerProfiles)
    .innerJoin(user, eq(user.id, learnerProfiles.userId))
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.subjectType, "individual"),
        eq(subscriptions.subjectId, learnerProfiles.userId),
      ),
    )
    .leftJoin(enrollments, eq(enrollments.userId, learnerProfiles.userId))
    .leftJoin(certificates, eq(certificates.userId, learnerProfiles.userId))
    .where(eq(learnerProfiles.accountType, "individual"))
    .groupBy(user.id, learnerProfiles.userId, subscriptions.id)
    .orderBy(desc(learnerProfiles.createdAt));
}

export async function getAllSubscriptions() {
  const [tenantSubscriptions, individualSubscriptions] = await Promise.all([
    getTenantSubscriptions(),
    getIndividualSubscriptions(),
  ]);

  return { tenantSubscriptions, individualSubscriptions };
}

export async function getRecentActivity() {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      organizationId: auditLogs.organizationId,
      actorUserId: auditLogs.actorUserId,
      createdAt: auditLogs.createdAt,
      organizationName: organizations.name,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLogs)
    .leftJoin(organizations, eq(organizations.id, auditLogs.organizationId))
    .leftJoin(user, eq(user.id, auditLogs.actorUserId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30);
}

export async function getPlatformUsage() {
  const [conversationCount] = await db.select({ value: count() }).from(aiConversations);
  return { aiConversations: conversationCount.value };
}

export async function getAppAdminOverview(currentUser: AppAdminUser) {
  await requireAppAdmin(currentUser);

  const [stats, tenantSubscriptions, individualSubscriptions, recentActivity, usage] = await Promise.all([
    getStats(),
    getTenantSubscriptions(),
    getIndividualSubscriptions(),
    getRecentActivity(),
    getPlatformUsage(),
  ]);

  return {
    stats,
    tenantSubscriptions,
    individualSubscriptions,
    recentActivity,
    usage,
  };
}

export async function getAppAdminTenants(currentUser: AppAdminUser) {
  await requireAppAdmin(currentUser);
  return getTenantSubscriptions();
}

export async function getAppAdminLearners(currentUser: AppAdminUser) {
  await requireAppAdmin(currentUser);
  return getIndividualSubscriptions();
}

export async function getAppAdminSubscriptions(currentUser: AppAdminUser) {
  await requireAppAdmin(currentUser);
  return getAllSubscriptions();
}

export async function getAppAdminBilling(currentUser: AppAdminUser) {
  await requireAppAdmin(currentUser);
  const [stats, subscriptionsData] = await Promise.all([getStats(), getAllSubscriptions()]);
  return { stats, ...subscriptionsData, planCatalog };
}

export async function getAppAdminActivity(currentUser: AppAdminUser) {
  await requireAppAdmin(currentUser);
  return getRecentActivity();
}

export async function updateSubscription(
  currentUser: AppAdminUser,
  subscriptionId: string,
  input: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    seats: number;
    billingEmail?: string;
    currentPeriodEnd?: string;
    notes?: string;
  },
) {
  await requireAppAdmin(currentUser);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) {
    throw new AppError("NOT_FOUND", "Subscription not found", 404);
  }

  const currentPeriodEnd = input.currentPeriodEnd
    ? new Date(input.currentPeriodEnd)
    : null;

  const [updated] = await db
    .update(subscriptions)
    .set({
      plan: input.plan,
      status: input.status,
      seats: input.seats,
      billingEmail: input.billingEmail || null,
      currentPeriodEnd,
      canceledAt: input.status === "canceled" ? new Date() : null,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return updated;
}

export async function getPlatformContentCourses() {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      category: courses.category,
      level: courses.level,
      status: courses.status,
      aiGenerated: courses.aiGenerated,
      estimatedMinutes: courses.estimatedMinutes,
      priceCents: courses.priceCents,
      ownerId: courses.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      moduleCount: sql<number>`count(distinct ${courseModules.id})::int`,
      enrollmentCount: sql<number>`count(distinct ${enrollments.id})::int`,
      completionCount: sql<number>`count(distinct case when ${enrollments.status} = 'completed' then ${enrollments.id} end)::int`,
      averageProgress: sql<number>`coalesce(round(avg(${enrollments.progress})), 0)::int`,
      submissionCount: sql<number>`count(distinct ${assessmentSubmissions.id})::int`,
      certificateCount: sql<number>`count(distinct ${certificates.id})::int`,
    })
    .from(courses)
    .leftJoin(user, eq(user.id, courses.ownerId))
    .leftJoin(courseModules, eq(courseModules.courseId, courses.id))
    .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
    .leftJoin(assessmentSubmissions, eq(assessmentSubmissions.enrollmentId, enrollments.id))
    .leftJoin(certificates, eq(certificates.courseId, courses.id))
    .where(isNull(courses.organizationId))
    .groupBy(courses.id, user.id)
    .orderBy(desc(courses.updatedAt));
}

export async function getPlatformContentStudio(currentUser: AppAdminUser) {
  const admin = await requirePlatformContentAccess(currentUser);
  const courses = await getPlatformContentCourses();
  const published = courses.filter((course) => course.status === "published").length;
  const drafts = courses.filter((course) => course.status === "draft").length;
  const archived = courses.filter((course) => course.status === "archived").length;
  const modules = courses.reduce((sum, course) => sum + Number(course.moduleCount ?? 0), 0);
  const minutes = courses.reduce((sum, course) => sum + Number(course.estimatedMinutes ?? 0), 0);
  const enrollments = courses.reduce((sum, course) => sum + Number(course.enrollmentCount ?? 0), 0);
  const completions = courses.reduce((sum, course) => sum + Number(course.completionCount ?? 0), 0);
  const certificatesIssued = courses.reduce((sum, course) => sum + Number(course.certificateCount ?? 0), 0);
  const submissions = courses.reduce((sum, course) => sum + Number(course.submissionCount ?? 0), 0);
  const categoryRows = new Map<string, { category: string; courses: number; enrollments: number; minutes: number }>();

  for (const course of courses) {
    const row = categoryRows.get(course.category) ?? { category: course.category, courses: 0, enrollments: 0, minutes: 0 };
    row.courses += 1;
    row.enrollments += Number(course.enrollmentCount ?? 0);
    row.minutes += Number(course.estimatedMinutes ?? 0);
    categoryRows.set(course.category, row);
  }

  return {
    admin,
    courses,
    stats: {
      totalCourses: courses.length,
      published,
      drafts,
      archived,
      modules,
      minutes,
      enrollments,
      completions,
      certificatesIssued,
      submissions,
      completionRate: enrollments > 0 ? Math.round((completions / enrollments) * 100) : 0,
    },
    categories: [...categoryRows.values()].sort((a, b) => b.enrollments - a.enrollments),
    reviewQueue: courses.filter((course) => course.status !== "published"),
    topCourses: [...courses].sort((a, b) => Number(b.enrollmentCount ?? 0) - Number(a.enrollmentCount ?? 0)).slice(0, 8),
  };
}
