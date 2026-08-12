import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { workspaces } from "@/db/schema/workspace";
import {
  ASSESSMENT_PURPOSES,
  CONTENT_TRACKS,
  COURSE_LEVELS,
  COURSE_STATUSES,
  ORGANIZATION_ROLES,
  ORGANIZATION_TYPES,
  QUESTION_TYPES,
  SUBSCRIPTION_PLANS,
  type AssessmentAnswer,
  type AssessmentQuestion,
} from "@/types/domain";

const timestampColumns = {
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
};

const idColumn = (name = "id") =>
  text(name)
    .$defaultFn(() => crypto.randomUUID())
    .notNull();

export const accountTypeEnum = pgEnum("account_type", [
  "individual",
  "organization",
]);

export const contentTrackEnum = pgEnum("content_track", CONTENT_TRACKS);

export const organizationTypeEnum = pgEnum("organization_type", ORGANIZATION_TYPES);

export const organizationRoleEnum = pgEnum("organization_role", ORGANIZATION_ROLES);

export const organizationMemberStatusEnum = pgEnum("organization_member_status", [
  "invited",
  "active",
  "suspended",
  "removed",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const appAdminRoleEnum = pgEnum("app_admin_role", ["owner", "admin", "content"]);

export const subscriptionSubjectEnum = pgEnum("subscription_subject", [
  "organization",
  "individual",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", SUBSCRIPTION_PLANS);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
]);

export const courseLevelEnum = pgEnum("course_level", COURSE_LEVELS);

export const courseStatusEnum = pgEnum("course_status", COURSE_STATUSES);

export const assessmentPurposeEnum = pgEnum("assessment_purpose", ASSESSMENT_PURPOSES);

export const contentAssetKindEnum = pgEnum("content_asset_kind", [
  "video",
  "audio",
  "document",
  "image",
  "interactive",
  "scorm",
  "h5p",
  "template",
]);

export const contentAssetStatusEnum = pgEnum("content_asset_status", [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
]);

export const placementScopeEnum = pgEnum("placement_scope", [
  "strict_lo_scope",
  "open_proficiency",
]);

export const placementStatusEnum = pgEnum("placement_status", [
  "draft",
  "submitted",
  "scored",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "system",
  "course",
  "assessment",
  "billing",
  "discussion",
]);

export const discussionVisibilityEnum = pgEnum("discussion_visibility", [
  "course",
  "organization",
  "private",
]);

export const moduleTypeEnum = pgEnum("module_type", [
  "video",
  "reading",
  "interactive",
  "quiz",
  "assignment",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "completed",
  "dropped",
]);

export const progressStatusEnum = pgEnum("progress_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const assessmentTypeEnum = pgEnum("assessment_type", [
  "quiz",
  "essay",
  "speaking",
  "project",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "graded",
  "needs_review",
]);

export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
  "system",
]);

export const certificateStatusEnum = pgEnum("certificate_status", [
  "issued",
  "revoked",
]);

export const questionTypeEnum = pgEnum("question_type", QUESTION_TYPES);

export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "canceled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const appAdmins = pgTable("app_admins", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: appAdminRoleEnum("role").default("admin").notNull(),
  status: text("status").default("active").notNull(),
  ...timestampColumns,
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: idColumn().primaryKey(),
    subjectType: subscriptionSubjectEnum("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    plan: subscriptionPlanEnum("plan").default("free").notNull(),
    status: subscriptionStatusEnum("status").default("trialing").notNull(),
    seats: integer("seats").default(1).notNull(),
    billingEmail: text("billing_email"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    trialEndsAt: timestamp("trial_ends_at"),
    canceledAt: timestamp("canceled_at"),
    provider: text("provider"),
    externalCustomerId: text("external_customer_id"),
    externalSubscriptionId: text("external_subscription_id"),
    billingInterval: text("billing_interval").default("monthly").notNull(),
    notes: text("notes"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("subscriptions_subject_unique").on(
      table.subjectType,
      table.subjectId,
    ),
    index("subscriptions_subject_idx").on(table.subjectType, table.subjectId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_plan_idx").on(table.plan),
    uniqueIndex("subscriptions_external_subscription_unique").on(
      table.provider,
      table.externalSubscriptionId,
    ),
  ],
);

export const subscriptionPlans = pgTable("subscription_plans", {
  code: subscriptionPlanEnum("code").primaryKey(),
  name: text("name").notNull(),
  monthlyPriceCents: integer("monthly_price_cents").notNull(),
  annualPriceCents: integer("annual_price_cents"),
  currency: text("currency").default("USD").notNull(),
  includedSeats: integer("included_seats").default(1).notNull(),
  courseLimit: integer("course_limit"),
  features: jsonb("features").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestampColumns,
});

export const invoices = pgTable(
  "invoices",
  {
    id: idColumn().primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    dueAt: timestamp("due_at"),
    paidAt: timestamp("paid_at"),
    items: jsonb("items")
      .$type<Array<{ description: string; quantity: number; unitAmountCents: number }>>()
      .default([])
      .notNull(),
    externalId: text("external_id"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("invoices_number_unique").on(table.invoiceNumber),
    uniqueIndex("invoices_external_unique").on(table.externalId),
    index("invoices_subscription_idx").on(table.subscriptionId, table.createdAt),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: idColumn().primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    paymentMethod: text("payment_method"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    transactionId: text("transaction_id"),
    failureReason: text("failure_reason"),
    refundedAt: timestamp("refunded_at"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("payments_transaction_unique").on(table.provider, table.transactionId),
    index("payments_invoice_idx").on(table.invoiceId, table.createdAt),
  ],
);

export const paymentWebhookEventStatusEnum = pgEnum("payment_webhook_event_status", [
  "received",
  "processed",
  "failed",
  "ignored",
]);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: idColumn().primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    signatureVerified: boolean("signature_verified").default(true).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: paymentWebhookEventStatusEnum("status").default("received").notNull(),
    processedAt: timestamp("processed_at"),
    attemptCount: integer("attempt_count").default(1).notNull(),
    lastError: text("last_error"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("payment_webhook_events_provider_event_unique").on(
      table.provider,
      table.providerEventId,
    ),
    index("payment_webhook_events_status_idx").on(table.status, table.createdAt),
  ],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    feature: text("feature").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unit: text("unit").notNull(),
    costCents: integer("cost_cents").default(0).notNull(),
    recordedAt: timestamp("recorded_at")
      .$defaultFn(() => new Date())
      .notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("usage_records_org_date_idx").on(table.organizationId, table.recordedAt),
    index("usage_records_user_date_idx").on(table.userId, table.recordedAt),
    index("usage_records_feature_idx").on(table.feature),
  ],
);

export const learnerProfiles = pgTable("learner_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  accountType: accountTypeEnum("account_type").default("individual").notNull(),
  headline: text("headline"),
  goals: jsonb("goals").$type<string[]>().default([]).notNull(),
  interests: jsonb("interests").$type<string[]>().default([]).notNull(),
  proficiencyLevel: text("proficiency_level").default("beginner").notNull(),
  targetStudyMinutes: integer("target_study_minutes").default(120).notNull(),
  ...timestampColumns,
});

export const organizations = pgTable(
  "organizations",
  {
    id: idColumn().primaryKey(),
    // §4.4: an organization is business metadata attached 1:1 to an ORGANIZATION
    // workspace. The workspace, not this table, is the tenant/security boundary.
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    domain: text("domain"),
    plan: text("plan").default("free").notNull(),
    type: organizationTypeEnum("type").default("institution").notNull(),
    primaryContentTrack: contentTrackEnum("primary_content_track").default("PRO").notNull(),
    curriculumMode: text("curriculum_mode").default("inherited").notNull(),
    brandColor: text("brand_color").default("#2563eb").notNull(),
    logoUrl: text("logo_url"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    uniqueIndex("organizations_domain_unique").on(table.domain),
    uniqueIndex("organizations_workspace_unique").on(table.workspaceId),
    index("organizations_owner_idx").on(table.ownerId),
  ],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").default("learner").notNull(),
    status: organizationMemberStatusEnum("status").default("active").notNull(),
    ...timestampColumns,
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.userId],
      name: "organization_members_pk",
    }),
    index("organization_members_user_idx").on(table.userId),
    index("organization_members_role_idx").on(table.organizationId, table.role),
  ],
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organizationRoleEnum("role").default("learner").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("organization_invitations_token_unique").on(table.tokenHash),
    index("organization_invitations_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("organization_invitations_email_idx").on(table.email),
  ],
);

export const guardianLearners = pgTable(
  "guardian_learners",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    guardianUserId: text("guardian_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    learnerUserId: text("learner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestampColumns,
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.guardianUserId, table.learnerUserId],
      name: "guardian_learners_pk",
    }),
    index("guardian_learners_guardian_idx").on(table.guardianUserId),
    index("guardian_learners_learner_idx").on(table.learnerUserId),
  ],
);

export const courses = pgTable(
  "courses",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    contentTrack: contentTrackEnum("content_track").default("GEN").notNull(),
    curriculumCode: text("curriculum_code"),
    schoolLevel: text("school_level"),
    gradeLabel: text("grade_label"),
    subjectCode: text("subject_code"),
    skillFramework: text("skill_framework"),
    language: text("language").default("en").notNull(),
    prerequisites: jsonb("prerequisites").$type<string[]>().default([]).notNull(),
    standards: jsonb("standards")
      .$type<Array<{ framework: string; codes: string[] }>>()
      .default([])
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    level: courseLevelEnum("level").default("beginner").notNull(),
    status: courseStatusEnum("status").default("draft").notNull(),
    aiGenerated: boolean("ai_generated").default(false).notNull(),
    aiConfidence: integer("ai_confidence"),
    isPublic: boolean("is_public").default(false).notNull(),
    isTemplate: boolean("is_template").default(false).notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    estimatedMinutes: integer("estimated_minutes").default(60).notNull(),
    publishedAt: timestamp("published_at"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("courses_org_slug_unique").on(table.organizationId, table.slug),
    index("courses_owner_idx").on(table.ownerId),
    index("courses_org_status_idx").on(table.organizationId, table.status),
    index("courses_search_idx").on(table.category, table.level, table.status),
  ],
);

export const courseVersions = pgTable(
  "course_versions",
  {
    id: idColumn().primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    revisionNotes: text("revision_notes"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("course_versions_course_version_unique").on(
      table.courseId,
      table.version,
    ),
    index("course_versions_course_idx").on(table.courseId),
  ],
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: idColumn().primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    position: integer("position").notNull(),
    type: moduleTypeEnum("type").default("reading").notNull(),
    content: text("content").notNull(),
    estimatedMinutes: integer("estimated_minutes").default(20).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("course_modules_course_idx").on(table.courseId),
    uniqueIndex("course_modules_position_unique").on(
      table.courseId,
      table.position,
    ),
  ],
);

export const assessments = pgTable(
  "assessments",
  {
    id: idColumn().primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: text("module_id").references(() => courseModules.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    type: assessmentTypeEnum("type").default("quiz").notNull(),
    purpose: assessmentPurposeEnum("purpose").default("formative").notNull(),
    prompt: text("prompt").notNull(),
    questions: jsonb("questions").$type<AssessmentQuestion[]>().default([]).notNull(),
    rubric: jsonb("rubric").$type<string[]>().default([]).notNull(),
    maxScore: integer("max_score").default(100).notNull(),
    passingScore: integer("passing_score").default(70).notNull(),
    timeLimitMinutes: integer("time_limit_minutes"),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    retakeCooldownMinutes: integer("retake_cooldown_minutes").default(0).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("assessments_course_idx").on(table.courseId),
    index("assessments_module_idx").on(table.moduleId),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: idColumn().primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    status: enrollmentStatusEnum("status").default("active").notNull(),
    progress: integer("progress").default(0).notNull(),
    completedAt: timestamp("completed_at"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("enrollments_user_course_unique").on(
      table.userId,
      table.courseId,
    ),
    index("enrollments_user_idx").on(table.userId),
    index("enrollments_org_idx").on(table.organizationId),
    index("enrollments_course_idx").on(table.courseId),
  ],
);

export const moduleProgress = pgTable(
  "module_progress",
  {
    id: idColumn().primaryKey(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: progressStatusEnum("status").default("not_started").notNull(),
    score: integer("score"),
    timeSpentMinutes: integer("time_spent_minutes").default(0).notNull(),
    completedAt: timestamp("completed_at"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("module_progress_enrollment_module_unique").on(
      table.enrollmentId,
      table.moduleId,
    ),
    index("module_progress_user_idx").on(table.userId),
  ],
);

export const assessmentSubmissions = pgTable(
  "assessment_submissions",
  {
    id: idColumn().primaryKey(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    answers: jsonb("answers").$type<AssessmentAnswer[]>().default([]).notNull(),
    attemptNumber: integer("attempt_number").default(1).notNull(),
    score: integer("score"),
    feedback: text("feedback"),
    status: submissionStatusEnum("status").default("submitted").notNull(),
    startedAt: timestamp("started_at")
      .$defaultFn(() => new Date())
      .notNull(),
    submittedAt: timestamp("submitted_at")
      .$defaultFn(() => new Date())
      .notNull(),
    gradedById: text("graded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    aiFeedback: jsonb("ai_feedback").$type<Record<string, unknown>>(),
    ...timestampColumns,
  },
  (table) => [
    index("assessment_submissions_user_idx").on(table.userId),
    index("assessment_submissions_assessment_idx").on(table.assessmentId),
    uniqueIndex("assessment_submissions_attempt_unique").on(
      table.assessmentId,
      table.userId,
      table.attemptNumber,
    ),
  ],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    moduleId: text("module_id").references(() => courseModules.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status").default("active").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().default({}).notNull(),
    endedAt: timestamp("ended_at"),
    ...timestampColumns,
  },
  (table) => [
    index("ai_conversations_user_idx").on(table.userId),
    index("ai_conversations_user_created_idx").on(table.userId, table.createdAt),
    index("ai_conversations_user_status_idx").on(table.userId, table.status),
    index("ai_conversations_org_idx").on(table.organizationId),
    index("ai_conversations_course_idx").on(table.courseId),
  ],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: idColumn().primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: aiMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    costMicros: integer("cost_micros").default(0).notNull(),
    provider: text("provider"),
    model: text("model"),
    responseTimeMs: integer("response_time_ms"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("ai_messages_conversation_idx").on(table.conversationId)],
);

export const aiConfigurations = pgTable(
  "ai_configurations",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    requestsPerMinute: integer("requests_per_minute").default(20).notNull(),
    monthlyBudgetCents: integer("monthly_budget_cents"),
    isActive: boolean("is_active").default(true).notNull(),
    updatedById: text("updated_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("ai_configurations_org_feature_unique").on(
      table.organizationId,
      table.feature,
    ),
    index("ai_configurations_feature_idx").on(table.feature, table.isActive),
  ],
);

export const aiUsageRecords = pgTable(
  "ai_usage_records",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    costMicros: integer("cost_micros").default(0).notNull(),
    responseTimeMs: integer("response_time_ms"),
    success: boolean("success").default(true).notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("ai_usage_org_created_idx").on(table.organizationId, table.createdAt),
    index("ai_usage_user_created_idx").on(table.userId, table.createdAt),
    index("ai_usage_feature_idx").on(table.feature, table.provider),
  ],
);

export const aiGenerationJobs = pgTable(
  "ai_generation_jobs",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    inputFileUrl: text("input_file_url"),
    input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
    status: aiJobStatusEnum("status").default("queued").notNull(),
    progress: integer("progress").default(0).notNull(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    provider: text("provider"),
    model: text("model"),
    error: text("error"),
    completedAt: timestamp("completed_at"),
    ...timestampColumns,
  },
  (table) => [
    index("ai_generation_jobs_org_status_idx").on(table.organizationId, table.status),
    index("ai_generation_jobs_user_idx").on(table.userId),
  ],
);

export const certificates = pgTable(
  "certificates",
  {
    id: idColumn().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    title: text("title").notNull(),
    status: certificateStatusEnum("status").default("issued").notNull(),
    issuedAt: timestamp("issued_at")
      .$defaultFn(() => new Date())
      .notNull(),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("certificates_enrollment_unique").on(table.enrollmentId),
    uniqueIndex("certificates_credential_unique").on(table.credentialId),
    index("certificates_user_idx").on(table.userId),
  ],
);

export const contentTracks = pgTable("content_tracks", {
  id: contentTrackEnum("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  targetAudience: text("target_audience").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestampColumns,
});

export const curricula = pgTable(
  "curricula",
  {
    id: idColumn().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    track: contentTrackEnum("track").default("SCH").notNull(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    source: text("source").default("system").notNull(),
    regions: jsonb("regions").$type<string[]>().default([]).notNull(),
    characteristics: text("characteristics").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("curricula_code_idx").on(table.code),
    index("curricula_track_idx").on(table.track),
    index("curricula_org_idx").on(table.organizationId),
  ],
);

export const subjects = pgTable(
  "subjects",
  {
    id: idColumn().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    track: contentTrackEnum("track").default("SCH").notNull(),
    description: text("description"),
    keyTopics: jsonb("key_topics").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("subjects_code_unique").on(table.code),
    index("subjects_track_idx").on(table.track),
  ],
);

export const learningObjectives = pgTable(
  "learning_objectives",
  {
    id: idColumn().primaryKey(),
    objectiveId: text("objective_id").notNull(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    track: contentTrackEnum("track").default("SCH").notNull(),
    curriculumCode: text("curriculum_code").notNull(),
    levelCode: text("level_code").notNull(),
    gradeLabel: text("grade_label").notNull(),
    subjectCode: text("subject_code").notNull(),
    topic: text("topic").notNull(),
    objective: text("objective").notNull(),
    bloomTaxonomy: text("bloom_taxonomy").notNull(),
    assessmentTypes: jsonb("assessment_types").$type<string[]>().default([]).notNull(),
    keywords: jsonb("keywords").$type<string[]>().default([]).notNull(),
    prerequisites: jsonb("prerequisites").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("learning_objectives_objective_id_unique").on(table.objectiveId),
    index("learning_objectives_scope_idx").on(table.track, table.curriculumCode, table.levelCode, table.gradeLabel, table.subjectCode),
    index("learning_objectives_org_idx").on(table.organizationId),
  ],
);

export const courseLearningObjectives = pgTable(
  "course_learning_objectives",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    learningObjectiveId: text("learning_objective_id")
      .notNull()
      .references(() => learningObjectives.id, { onDelete: "cascade" }),
    ...timestampColumns,
  },
  (table) => [
    primaryKey({
      columns: [table.courseId, table.learningObjectiveId],
      name: "course_learning_objectives_pk",
    }),
    index("course_learning_objectives_objective_idx").on(table.learningObjectiveId),
  ],
);

export const placementTests = pgTable(
  "placement_tests",
  {
    id: idColumn().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    courseId: text("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    track: contentTrackEnum("track").notNull(),
    curriculumCode: text("curriculum_code"),
    levelCode: text("level_code"),
    gradeLabel: text("grade_label"),
    subjectCode: text("subject_code"),
    skillFramework: text("skill_framework"),
    scope: placementScopeEnum("scope").notNull(),
    status: placementStatusEnum("status").default("draft").notNull(),
    score: integer("score"),
    recommendedLevel: text("recommended_level"),
    report: jsonb("report").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("placement_tests_user_idx").on(table.userId),
    index("placement_tests_org_idx").on(table.organizationId),
    index("placement_tests_scope_idx").on(table.track, table.curriculumCode, table.subjectCode),
  ],
);

export const placementResponses = pgTable(
  "placement_responses",
  {
    id: idColumn().primaryKey(),
    placementTestId: text("placement_test_id")
      .notNull()
      .references(() => placementTests.id, { onDelete: "cascade" }),
    learningObjectiveId: text("learning_objective_id").references(() => learningObjectives.id, {
      onDelete: "set null",
    }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    isCorrect: boolean("is_correct"),
    score: integer("score"),
    feedback: text("feedback"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("placement_responses_test_idx").on(table.placementTestId)],
);

export const contentAssets = pgTable(
  "content_assets",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    kind: contentAssetKindEnum("kind").notNull(),
    status: contentAssetStatusEnum("status").default("draft").notNull(),
    sourceUrl: text("source_url"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("content_assets_org_idx").on(table.organizationId),
    index("content_assets_owner_idx").on(table.ownerId),
    index("content_assets_kind_status_idx").on(table.kind, table.status),
  ],
);

export const personalLibraryItems = pgTable(
  "personal_library_items",
  {
    id: idColumn().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
    assetId: text("asset_id").references(() => contentAssets.id, { onDelete: "cascade" }),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("personal_library_items_user_idx").on(table.userId),
    index("personal_library_items_course_idx").on(table.courseId),
    index("personal_library_items_asset_idx").on(table.assetId),
  ],
);

export const discussionThreads = pgTable(
  "discussion_threads",
  {
    id: idColumn().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    visibility: discussionVisibilityEnum("visibility").default("course").notNull(),
    status: text("status").default("open").notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("discussion_threads_org_idx").on(table.organizationId),
    index("discussion_threads_course_idx").on(table.courseId),
  ],
);

export const discussionPosts = pgTable(
  "discussion_posts",
  {
    id: idColumn().primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => discussionThreads.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    ...timestampColumns,
  },
  (table) => [index("discussion_posts_thread_idx").on(table.threadId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: idColumn().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").default("system").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    readAt: timestamp("read_at"),
    ...timestampColumns,
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_unread_idx").on(table.userId, table.readAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorUserId),
    index("audit_logs_org_idx").on(table.organizationId),
  ],
);
