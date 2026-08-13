import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { AppError } from "@/lib/api/response";
import { getOrganizationMembership } from "@/lib/permissions";
import { getAppAdmin } from "@/lib/services/app-admin";
import { provisionWorkspace } from "@/lib/services/workspace";
import { canReadCourse } from "@/lib/authorization/course-access";
import { gradeAssessmentAnswers } from "@/lib/assessments/grading";
import type { AssessmentAnswer } from "@/types/domain";
import {
  assessmentSubmissions,
  assessments,
  auditLogs,
  certificates,
  courseModules,
  courseVersions,
  courses,
  contentAssets,
  enrollments,
  guardianLearners,
  learnerProfiles,
  moduleProgress,
  organizationMembers,
  organizations,
  subscriptions,
} from "@/db/schema/learning";
import type {
  courseCreateSchema,
  courseUpdateSchema,
  onboardingSchema,
  organizationCreateSchema,
  paginationSchema,
} from "@/lib/validations";
import type { z } from "zod";

export type CourseListParams = z.infer<typeof paginationSchema>;
export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;

type User = { id: string; name?: string | null; email?: string | null };

export async function ensureLearnerProfile(user: User) {
  const [existing] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, user.id))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(learnerProfiles)
    .values({ userId: user.id })
    .returning();

  await db.insert(subscriptions).values({
    subjectType: "individual",
    subjectId: user.id,
    plan: "free",
    status: "trialing",
    seats: 1,
    billingEmail: user.email || null,
  }).onConflictDoNothing();

  return created;
}

export async function saveOnboarding(user: User, input: OnboardingInput) {
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(learnerProfiles)
      .values({
        userId: user.id,
        accountType: input.accountType,
        headline: input.headline,
        goals: input.goals,
        interests: input.interests,
        proficiencyLevel: input.proficiencyLevel,
        targetStudyMinutes: input.targetStudyMinutes,
      })
      .onConflictDoUpdate({
        target: learnerProfiles.userId,
        set: {
          accountType: input.accountType,
          headline: input.headline,
          goals: input.goals,
          interests: input.interests,
          proficiencyLevel: input.proficiencyLevel,
          targetStudyMinutes: input.targetStudyMinutes,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (input.accountType === "individual") {
      await tx.insert(subscriptions).values({
        subjectType: "individual",
        subjectId: user.id,
        plan: "free",
        status: "trialing",
        seats: 1,
        billingEmail: user.email || null,
      }).onConflictDoNothing();
    }

    let organization = null;

    if (input.accountType === "organization" && input.organization) {
      // §4.4: every organization is 1:1 with an Organization Workspace, and
      // organizations.workspace_id is NOT NULL since 0011 — so the workspace and
      // its founding ORG_OWNER membership must exist before the organization row.
      const { workspace } = await provisionWorkspace(tx, {
        type: "ORGANIZATION",
        name: input.organization.name,
        ownerUserId: user.id,
        roleCodes: ["ORG_OWNER"],
      });

      [organization] = await tx
        .insert(organizations)
        .values({
          workspaceId: workspace.id,
          name: input.organization.name,
          slug: input.organization.slug,
          description: input.organization.description,
          domain: input.organization.domain || null,
          type: input.organization.type,
          primaryContentTrack: input.organization.type === "school" ? "SCH" : input.organization.primaryContentTrack,
          curriculumMode: input.organization.type === "school" ? input.organization.curriculumMode : "inherited",
          ownerId: user.id,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: "owner",
      });

      await tx.insert(subscriptions).values({
        subjectType: "organization",
        subjectId: organization.id,
        plan: "free",
        status: "trialing",
        seats: 1,
        billingEmail: user.email || null,
      }).onConflictDoNothing();

      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        organizationId: organization.id,
        action: "organization.created",
        entityType: "organization",
        entityId: organization.id,
      });

      // §4.9/ADR-020: organization workspace creation is an audited event in its
      // own right, separate from the organization record it backs.
      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        organizationId: organization.id,
        action: "workspace.organization.created",
        entityType: "workspace",
        entityId: workspace.id,
        metadata: { workspaceType: "ORGANIZATION", organizationSlug: input.organization.slug },
      });
    }

    return { profile, organization };
  });
}

export async function getUserContext(user: User) {
  const profile = await ensureLearnerProfile(user);
  const memberships = await db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: organizationMembers.role,
      plan: organizations.plan,
      type: organizations.type,
      primaryContentTrack: organizations.primaryContentTrack,
      curriculumMode: organizations.curriculumMode,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, "active"),
      ),
    )
    .orderBy(asc(organizations.name));

  return { profile, memberships };
}

async function getUserOrganizationAccess(userId: string) {
  return db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active"),
      ),
    );
}

function sortColumn(sort: CourseListParams["sort"]) {
  if (sort === "title") return asc(courses.title);
  if (sort === "oldest") return asc(courses.createdAt);
  return desc(courses.createdAt);
}

export async function listCourses(user: User | null, params: CourseListParams) {
  const organizationAccess = user ? await getUserOrganizationAccess(user.id) : [];
  const orgIds = organizationAccess.map((membership) => membership.organizationId);
  const managerOrgIds = organizationAccess
    .filter((membership) => ["owner", "admin", "content", "teacher"].includes(membership.role))
    .map((membership) => membership.organizationId);
  const accessRules: SQL<unknown>[] = [
    and(eq(courses.status, "published"), isNull(courses.organizationId))!,
  ];

  if (user) {
    accessRules.push(eq(courses.ownerId, user.id));
  }

  if (orgIds.length > 0) {
    accessRules.push(
      and(
        inArray(courses.organizationId, orgIds),
        eq(courses.status, "published"),
      )!,
    );
  }

  if (managerOrgIds.length > 0) {
    accessRules.push(inArray(courses.organizationId, managerOrgIds));
  }

  const filters: SQL<unknown>[] = [];
  const access = or(...accessRules);
  if (access) filters.push(access);

  if (params.search) {
    const search = or(
      ilike(courses.title, `%${params.search}%`),
      ilike(courses.description, `%${params.search}%`),
      ilike(courses.category, `%${params.search}%`),
    );
    if (search) filters.push(search);
  }

  if (params.category) {
    filters.push(eq(courses.category, params.category));
  }

  if (params.level) {
    filters.push(eq(courses.level, params.level));
  }

  const where = and(...filters);
  const offset = (params.page - 1) * params.pageSize;

  const data = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      category: courses.category,
      contentTrack: courses.contentTrack,
      curriculumCode: courses.curriculumCode,
      schoolLevel: courses.schoolLevel,
      gradeLabel: courses.gradeLabel,
      subjectCode: courses.subjectCode,
      skillFramework: courses.skillFramework,
      level: courses.level,
      status: courses.status,
      aiGenerated: courses.aiGenerated,
      estimatedMinutes: courses.estimatedMinutes,
      organizationId: courses.organizationId,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .where(where)
    .orderBy(sortColumn(params.sort))
    .limit(params.pageSize)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(courses).where(where);

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getDashboardData(user: User) {
  const context = await getUserContext(user);
  const userEnrollments = await db
    .select({
      id: enrollments.id,
      courseId: enrollments.courseId,
      status: enrollments.status,
      progress: enrollments.progress,
      completedAt: enrollments.completedAt,
      title: courses.title,
      category: courses.category,
      level: courses.level,
      estimatedMinutes: courses.estimatedMinutes,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, user.id))
    .orderBy(desc(enrollments.updatedAt));

  const certificatesRows = await db
    .select({ id: certificates.id })
    .from(certificates)
    .where(eq(certificates.userId, user.id));

  const recommended = await listCourses(user, {
    page: 1,
    pageSize: 4,
    sort: "newest",
  });

  const activeEnrollments = userEnrollments.filter((row) => row.status === "active");
  const completedEnrollments = userEnrollments.filter(
    (row) => row.status === "completed" || row.progress >= 100,
  );
  const averageProgress = userEnrollments.length
    ? Math.round(
        userEnrollments.reduce((sum, row) => sum + row.progress, 0) /
          userEnrollments.length,
      )
    : 0;

  return {
    context,
    stats: {
      activeCourses: activeEnrollments.length,
      completedCourses: completedEnrollments.length,
      certificates: certificatesRows.length,
      averageProgress,
    },
    enrollments: userEnrollments,
    recommended: recommended.data,
  };
}

export async function getCourseDetail(user: User | null, courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));

  if (!course) {
    throw new AppError("NOT_FOUND", "Course not found", 404);
  }

  const membership = user && course.organizationId
    ? await getOrganizationMembership(user.id, course.organizationId)
    : null;
  const appAdmin = user && !course.organizationId ? await getAppAdmin(user.id) : null;
  const canAccess = canReadCourse(course, {
    userId: user?.id,
    organizationRole: membership?.role,
    isPlatformContentManager: Boolean(
      appAdmin && ["owner", "content"].includes(appAdmin.role),
    ),
  });

  if (!canAccess) {
    throw new AppError("FORBIDDEN", "You do not have access to this course", 403);
  }

  const modules = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.courseId, course.id))
    .orderBy(asc(courseModules.position));

  const courseAssessments = await db
    .select()
    .from(assessments)
    .where(eq(assessments.courseId, course.id))
    .orderBy(asc(assessments.createdAt));

  const [enrollment] = user
    ? await db
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, course.id)))
        .limit(1)
    : [];

  const progress = enrollment
    ? await db
        .select()
        .from(moduleProgress)
        .where(eq(moduleProgress.enrollmentId, enrollment.id))
    : [];

  return { course, modules, assessments: courseAssessments, enrollment, progress };
}

export async function getCourseModuleDetail(user: User, courseId: string, moduleId: string) {
  const detail = await getCourseDetail(user, courseId);
  const lessonModule = detail.modules.find((item) => item.id === moduleId);

  if (!lessonModule) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }

  const assetAccess = detail.course.organizationId
    ? or(
        isNull(contentAssets.organizationId),
        eq(contentAssets.organizationId, detail.course.organizationId),
      )
    : isNull(contentAssets.organizationId);
  const allPublishedAssets = await db
    .select()
    .from(contentAssets)
    .where(and(eq(contentAssets.status, "published"), assetAccess))
    .orderBy(desc(contentAssets.updatedAt))
    .limit(200);

  const scopeTags = [
    detail.course.contentTrack,
    detail.course.curriculumCode,
    detail.course.subjectCode,
    detail.course.gradeLabel,
  ].filter((tag): tag is string => Boolean(tag));

  const scopedAssets = allPublishedAssets
    .filter((asset) => scopeTags.every((tag) => asset.tags.includes(tag)))
    .slice(0, 8);

  const currentProgress = detail.progress.find((row) => row.moduleId === lessonModule.id);
  const moduleAssessments = detail.assessments.filter((assessment) => assessment.moduleId === lessonModule.id);
  const nextModule = detail.modules.find((item) => item.position === lessonModule.position + 1) ?? null;
  const previousModule = detail.modules.find((item) => item.position === lessonModule.position - 1) ?? null;

  return {
    ...detail,
    module: lessonModule,
    currentProgress,
    moduleAssessments,
    nextModule,
    previousModule,
    assets: scopedAssets,
  };
}

export async function createOrganization(user: User, input: OrganizationCreateInput) {
  return db.transaction(async (tx) => {
  // See saveOnboarding: the Organization Workspace is provisioned first because
  // organizations.workspace_id is NOT NULL (§4.4, migration 0011).
  const { workspace } = await provisionWorkspace(tx, {
    type: "ORGANIZATION",
    name: input.name,
    ownerUserId: user.id,
    roleCodes: ["ORG_OWNER"],
  });

  const [organization] = await tx
    .insert(organizations)
    .values({
      workspaceId: workspace.id,
      name: input.name,
      slug: input.slug,
      description: input.description,
      domain: input.domain || null,
      brandColor: input.brandColor,
      type: input.type,
      primaryContentTrack: input.type === "school" ? "SCH" : input.primaryContentTrack,
      curriculumMode: input.type === "school" ? input.curriculumMode : "inherited",
      ownerId: user.id,
    })
    .returning();

  await tx.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: "owner",
  });

  await tx.insert(subscriptions).values({
    subjectType: "organization",
    subjectId: organization.id,
    plan: "free",
    status: "trialing",
    seats: 1,
    billingEmail: user.email || null,
  }).onConflictDoNothing();

  // §4.9/ADR-020: audited with actor and workspace lineage.
  await tx.insert(auditLogs).values({
    actorUserId: user.id,
    organizationId: organization.id,
    action: "workspace.organization.created",
    entityType: "workspace",
    entityId: workspace.id,
    metadata: { workspaceType: "ORGANIZATION", organizationSlug: input.slug },
  });

  return organization;
  });
}

export async function createCourse(user: User, input: CourseCreateInput) {
  if (!input.organizationId) {
    const appAdmin = await getAppAdmin(user.id);
    if (!appAdmin || !["owner", "content"].includes(appAdmin.role)) {
      throw new AppError("FORBIDDEN", "Only platform content managers can create global courses", 403);
    }
  }

  if (input.organizationId) {
    const membership = await getOrganizationMembership(user.id, input.organizationId);
    if (!membership || !["owner", "admin", "content", "teacher"].includes(membership.role)) {
      throw new AppError("FORBIDDEN", "You cannot create courses for this organization", 403);
    }
  }

  return db.transaction(async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        organizationId: input.organizationId || null,
        ownerId: user.id,
        title: input.title,
        slug: input.slug,
        description: input.description,
        category: input.category,
        contentTrack: input.contentTrack,
        curriculumCode: input.curriculumCode || null,
        schoolLevel: input.schoolLevel || null,
        gradeLabel: input.gradeLabel || null,
        subjectCode: input.subjectCode || null,
        skillFramework: input.skillFramework || null,
        level: input.level,
        status: input.status,
        aiGenerated: input.aiGenerated,
        priceCents: input.priceCents,
        estimatedMinutes: input.estimatedMinutes,
      })
      .returning();

    const modules = await tx
      .insert(courseModules)
      .values(
        input.modules.map((module, index) => ({
          courseId: course.id,
          title: module.title,
          summary: module.summary,
          type: module.type,
          content: module.content,
          estimatedMinutes: module.estimatedMinutes,
          position: index + 1,
        })),
      )
      .returning();

    const assessmentType = input.assessment.questions.some((question) => question.type === "essay")
      ? "essay"
      : input.assessment.questions.some((question) => question.type === "speaking")
        ? "speaking"
        : input.assessment.questions.some((question) => question.type === "project")
          ? "project"
          : "quiz";

    await tx.insert(assessments).values({
      courseId: course.id,
      moduleId: modules.at(-1)?.id,
      title: input.assessment.title,
      type: assessmentType,
      purpose: input.assessment.purpose,
      prompt: input.assessment.questions[0].prompt,
      questions: input.assessment.questions,
      rubric: [],
      maxScore: 100,
      passingScore: input.assessment.passingScore,
      maxAttempts: input.assessment.maxAttempts,
    });

    await tx.insert(courseVersions).values({
      courseId: course.id,
      version: 1,
      createdById: user.id,
      snapshot: { course, modules, assessment: input.assessment },
      revisionNotes: "Initial version",
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      organizationId: course.organizationId,
      action: "course.created",
      entityType: "course",
      entityId: course.id,
    });

    return { course, modules };
  });
}

export async function updateCourse(user: User, courseId: string, input: CourseUpdateInput) {
  const detail = await getCourseDetail(user, courseId);

  if (detail.course.organizationId === null) {
    const appAdmin = await getAppAdmin(user.id);
    if (detail.course.ownerId !== user.id && (!appAdmin || !["owner", "content"].includes(appAdmin.role))) {
      throw new AppError("FORBIDDEN", "You cannot update this platform course", 403);
    }
  } else if (detail.course.ownerId !== user.id) {
    const membership = await getOrganizationMembership(user.id, detail.course.organizationId);
    if (!membership || !["owner", "admin", "content", "teacher"].includes(membership.role)) {
      throw new AppError("FORBIDDEN", "You cannot update this course", 403);
    }
  }

  return db.transaction(async (tx) => {
    const { modules, ...courseInput } = input;
    const [course] = await tx
      .update(courses)
      .set({ ...courseInput, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();

    if (modules) {
      await tx.delete(courseModules).where(eq(courseModules.courseId, courseId));
      await tx.insert(courseModules).values(
        modules.map((module, index) => ({
          courseId,
          title: module.title,
          summary: module.summary,
          type: module.type,
          content: module.content,
          estimatedMinutes: module.estimatedMinutes,
          position: index + 1,
        })),
      );
    }

    return course;
  });
}

export async function enrollInCourse(user: User, courseId: string) {
  const detail = await getCourseDetail(user, courseId);

  return db.transaction(async (tx) => {
    await tx
      .insert(enrollments)
      .values({
        userId: user.id,
        courseId,
        organizationId: detail.course.organizationId,
      })
      .onConflictDoNothing({
        target: [enrollments.userId, enrollments.courseId],
      });

    const [enrollment] = await tx
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (!enrollment) {
      throw new AppError("INTERNAL_ERROR", "Enrollment could not be created", 500);
    }

    if (detail.modules.length > 0) {
      await tx
        .insert(moduleProgress)
        .values(
          detail.modules.map((module) => ({
            enrollmentId: enrollment.id,
            moduleId: module.id,
            userId: user.id,
          })),
        )
        .onConflictDoNothing({
          target: [moduleProgress.enrollmentId, moduleProgress.moduleId],
        });
    }

    return enrollment;
  });
}

export async function updateModuleProgress(
  user: User,
  moduleId: string,
  input: { enrollmentId: string; status: "in_progress" | "completed"; score?: number; timeSpentMinutes: number },
) {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, input.enrollmentId), eq(enrollments.userId, user.id)))
    .limit(1);

  if (!enrollment) {
    throw new AppError("NOT_FOUND", "Enrollment not found", 404);
  }

  const [module] = await db
    .select()
    .from(courseModules)
    .where(and(eq(courseModules.id, moduleId), eq(courseModules.courseId, enrollment.courseId)))
    .limit(1);

  if (!module) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }

  return db.transaction(async (tx) => {
    const completedAt = input.status === "completed" ? new Date() : null;

    const [progress] = await tx
      .insert(moduleProgress)
      .values({
        enrollmentId: enrollment.id,
        moduleId,
        userId: user.id,
        status: input.status,
        score: input.score,
        timeSpentMinutes: input.timeSpentMinutes,
        completedAt,
      })
      .onConflictDoUpdate({
        target: [moduleProgress.enrollmentId, moduleProgress.moduleId],
        set: {
          status: input.status,
          score: input.score,
          timeSpentMinutes: input.timeSpentMinutes,
          completedAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    const allModules = await tx
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(eq(courseModules.courseId, enrollment.courseId));
    const progressRows = await tx
      .select({ status: moduleProgress.status })
      .from(moduleProgress)
      .where(eq(moduleProgress.enrollmentId, enrollment.id));
    const completed = progressRows.filter((row) => row.status === "completed").length;
    const percent = allModules.length ? Math.round((completed / allModules.length) * 100) : 0;

    await tx
      .update(enrollments)
      .set({
        progress: percent,
        status: percent >= 100 ? "completed" : "active",
        completedAt: percent >= 100 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, enrollment.id));

    return { progress, enrollmentProgress: percent };
  });
}

export async function submitAssessment(
  user: User,
  assessmentId: string,
  input: { enrollmentId: string; answer?: string; answers?: AssessmentAnswer[] },
) {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, input.enrollmentId), eq(enrollments.userId, user.id)))
    .limit(1);

  if (!enrollment) {
    throw new AppError("NOT_FOUND", "Enrollment not found", 404);
  }

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.courseId, enrollment.courseId)))
    .limit(1);

  if (!assessment) {
    throw new AppError("NOT_FOUND", "Assessment not found", 404);
  }

  const previousAttempts = await db
    .select({
      attemptNumber: assessmentSubmissions.attemptNumber,
      submittedAt: assessmentSubmissions.submittedAt,
    })
    .from(assessmentSubmissions)
    .where(
      and(
        eq(assessmentSubmissions.assessmentId, assessmentId),
        eq(assessmentSubmissions.userId, user.id),
      ),
    )
    .orderBy(desc(assessmentSubmissions.attemptNumber));

  if (previousAttempts.length >= assessment.maxAttempts) {
    throw new AppError("CONFLICT", "The maximum number of attempts has been reached", 409);
  }

  const lastAttempt = previousAttempts[0];
  if (lastAttempt && assessment.retakeCooldownMinutes > 0) {
    const retryAt = new Date(
      lastAttempt.submittedAt.getTime() + assessment.retakeCooldownMinutes * 60_000,
    );
    if (retryAt > new Date()) {
      throw new AppError("CONFLICT", "This assessment is still in its retake cooldown", 409, {
        retryAt: retryAt.toISOString(),
      });
    }
  }

  const answers = input.answers ?? (
    input.answer && assessment.questions.length === 1
      ? [{ questionId: assessment.questions[0].id, text: input.answer }]
      : []
  );
  const duplicateQuestionIds = answers
    .map((answer) => answer.questionId)
    .filter((id, index, values) => values.indexOf(id) !== index);
  if (duplicateQuestionIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "Each question can only be answered once", 400);
  }

  const allowedQuestionIds = new Set(assessment.questions.map((question) => question.id));
  if (answers.some((answer) => !allowedQuestionIds.has(answer.questionId))) {
    throw new AppError("VALIDATION_ERROR", "An answer references an unknown question", 400);
  }

  const grade = assessment.questions.length > 0
    ? gradeAssessmentAnswers(assessment.questions, answers, assessment.maxScore)
    : { score: null, needsReview: true, grades: [] };
  const status = grade.needsReview ? "needs_review" : "graded";
  const feedback = grade.needsReview
    ? "Your response was submitted and is waiting for rubric-based review."
    : grade.score !== null && grade.score >= assessment.passingScore
      ? "Passed. Review the item feedback before continuing."
      : "Not yet passed. Review the item feedback and retry when eligible.";

  const [submission] = await db
    .insert(assessmentSubmissions)
    .values({
      assessmentId,
      enrollmentId: enrollment.id,
      userId: user.id,
      answer: input.answer ?? JSON.stringify(answers),
      answers,
      attemptNumber: previousAttempts.length + 1,
      score: grade.score,
      feedback,
      status,
      aiFeedback: { questionGrades: grade.grades },
    })
    .returning();

  return submission;
}

export async function issueCertificate(user: User, enrollmentId: string) {
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      progress: enrollments.progress,
      courseTitle: courses.title,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, user.id)))
    .limit(1);

  if (!enrollment) {
    throw new AppError("NOT_FOUND", "Enrollment not found", 404);
  }

  if (enrollment.progress < 100) {
    throw new AppError("FORBIDDEN", "Complete all modules before issuing a certificate", 403);
  }

  await db
    .insert(certificates)
    .values({
      userId: user.id,
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      credentialId: `CERT-${enrollment.id.slice(0, 8).toUpperCase()}`,
      title: `${enrollment.courseTitle} Certificate`,
    })
    .onConflictDoNothing({ target: certificates.enrollmentId });

  const [certificate] = await db
    .select()
    .from(certificates)
    .where(eq(certificates.enrollmentId, enrollment.id))
    .limit(1);

  return certificate;
}

export async function listCertificates(user: User) {
  return db
    .select({
      id: certificates.id,
      title: certificates.title,
      credentialId: certificates.credentialId,
      issuedAt: certificates.issuedAt,
      status: certificates.status,
      courseTitle: courses.title,
      category: courses.category,
    })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.userId, user.id))
    .orderBy(desc(certificates.issuedAt));
}

export async function getOrganizationDashboard(user: User) {
  const context = await getUserContext(user);
  const orgIds = context.memberships.map((row) => row.organizationId);

  if (orgIds.length === 0) {
    return { organizations: [], courses: [], members: [], enrollments: [] };
  }

  const managerCourseOrgIds = context.memberships
    .filter((membership) => ["owner", "admin", "content", "teacher"].includes(membership.role))
    .map((membership) => membership.organizationId);
  const courseAccess = or(
    and(inArray(courses.organizationId, orgIds), eq(courses.status, "published")),
    ...(managerCourseOrgIds.length > 0
      ? [inArray(courses.organizationId, managerCourseOrgIds)]
      : []),
  );
  const orgCourses = await db
    .select()
    .from(courses)
    .where(courseAccess)
    .orderBy(desc(courses.createdAt));

  const rosterOrgIds = context.memberships
    .filter((membership) => ["owner", "admin", "teacher"].includes(membership.role))
    .map((membership) => membership.organizationId);
  // §18/§13: only an ACTIVE relationship grants learner visibility. A PENDING
  // link (the default for new rows) and a REVOKED link grant nothing — access is
  // never inferred from row existence.
  const guardianLinks = await db
    .select()
    .from(guardianLearners)
    .where(
      and(
        eq(guardianLearners.guardianUserId, user.id),
        eq(guardianLearners.status, "ACTIVE"),
        inArray(guardianLearners.organizationId, orgIds),
      ),
    );
  const linkedLearnerIds = [...new Set(guardianLinks.map((link) => link.learnerUserId))];

  const members = rosterOrgIds.length > 0
    ? await db
        .select({
          organizationId: organizationMembers.organizationId,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .where(inArray(organizationMembers.organizationId, rosterOrgIds))
    : [];

  const enrollmentAccess: SQL<unknown>[] = [];
  if (rosterOrgIds.length > 0) {
    enrollmentAccess.push(inArray(enrollments.organizationId, rosterOrgIds));
  }
  if (linkedLearnerIds.length > 0) {
    enrollmentAccess.push(inArray(enrollments.userId, linkedLearnerIds));
  }
  const organizationEnrollments = enrollmentAccess.length > 0
    ? await db.select().from(enrollments).where(or(...enrollmentAccess))
    : [];

  return {
    organizations: context.memberships,
    courses: orgCourses,
    members,
    enrollments: organizationEnrollments,
  };
}
