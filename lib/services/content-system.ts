import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { user as users } from "@/db/schema/auth";
import {
  auditLogs,
  contentAssets,
  contentTracks,
  courses,
  curricula,
  discussionPosts,
  discussionThreads,
  learningObjectives,
  notifications,
  organizationMembers,
  organizations,
  personalLibraryItems,
  placementResponses,
  placementTests,
  subjects,
} from "@/db/schema/learning";
import { AppError } from "@/lib/api/response";
import { getOrganizationMembership } from "@/lib/permissions";
import { getAppAdmin } from "@/lib/services/app-admin";
import { getCourseDetail } from "@/lib/services/learning";
import type {
  contentAssetCreateSchema,
  curriculumCreateSchema,
  discussionCreateSchema,
  discussionPostCreateSchema,
  learningObjectiveCreateSchema,
  personalLibraryCreateSchema,
  placementStartSchema,
  placementSubmitSchema,
  taxonomyQuerySchema,
} from "@/lib/validations";
import type { z } from "zod";

type User = { id: string; email?: string | null; name?: string | null };
type TaxonomyQuery = z.infer<typeof taxonomyQuerySchema>;
type CurriculumCreateInput = z.infer<typeof curriculumCreateSchema>;
type LearningObjectiveCreateInput = z.infer<typeof learningObjectiveCreateSchema>;
type PlacementStartInput = z.infer<typeof placementStartSchema>;
type PlacementSubmitInput = z.infer<typeof placementSubmitSchema>;
type ContentAssetCreateInput = z.infer<typeof contentAssetCreateSchema>;
type PersonalLibraryCreateInput = z.infer<typeof personalLibraryCreateSchema>;
type DiscussionCreateInput = z.infer<typeof discussionCreateSchema>;
type DiscussionPostCreateInput = z.infer<typeof discussionPostCreateSchema>;


function isOrgManagerRole(role: string) {
  return ["owner", "admin", "content", "teacher"].includes(role);
}

async function requireTaxonomyWriteAccess(currentUser: User, organizationId?: string | null) {
  if (organizationId) {
    const membership = await getOrganizationMembership(currentUser.id, organizationId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new AppError("FORBIDDEN", "Organization admin access is required", 403);
    }
    return;
  }

  const admin = await getAppAdmin(currentUser.id);
  if (!admin || !["owner", "content"].includes(admin.role)) {
    throw new AppError("FORBIDDEN", "Platform content access is required", 403);
  }
}

async function getUserOrganizationIds(userId: string) {
  const rows = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "active")));
  return rows.map((row) => row.organizationId);
}

export async function listTaxonomy(input: TaxonomyQuery = {}, currentUser: User | null = null) {
  const curriculumFilters: SQL<unknown>[] = [eq(curricula.isActive, true)];
  const subjectFilters: SQL<unknown>[] = [eq(subjects.isActive, true)];
  const objectiveFilters: SQL<unknown>[] = [eq(learningObjectives.isActive, true)];

  const appAdmin = currentUser ? await getAppAdmin(currentUser.id) : null;
  if (!appAdmin || !["owner", "content"].includes(appAdmin.role)) {
    const organizationIds = currentUser ? await getUserOrganizationIds(currentUser.id) : [];
    const curriculumAccess = organizationIds.length
      ? or(isNull(curricula.organizationId), inArray(curricula.organizationId, organizationIds))
      : isNull(curricula.organizationId);
    const objectiveAccess = organizationIds.length
      ? or(
          isNull(learningObjectives.organizationId),
          inArray(learningObjectives.organizationId, organizationIds),
        )
      : isNull(learningObjectives.organizationId);
    if (curriculumAccess) curriculumFilters.push(curriculumAccess);
    if (objectiveAccess) objectiveFilters.push(objectiveAccess);
  }

  if (input.track) {
    curriculumFilters.push(eq(curricula.track, input.track));
    subjectFilters.push(eq(subjects.track, input.track));
    objectiveFilters.push(eq(learningObjectives.track, input.track));
  }
  if (input.curriculumCode) objectiveFilters.push(eq(learningObjectives.curriculumCode, input.curriculumCode));
  if (input.subjectCode) objectiveFilters.push(eq(learningObjectives.subjectCode, input.subjectCode));
  if (input.levelCode) objectiveFilters.push(eq(learningObjectives.levelCode, input.levelCode));
  if (input.gradeLabel) objectiveFilters.push(eq(learningObjectives.gradeLabel, input.gradeLabel));
  if (input.search) {
    const search = or(
      ilike(learningObjectives.objective, `%${input.search}%`),
      ilike(learningObjectives.topic, `%${input.search}%`),
      ilike(learningObjectives.objectiveId, `%${input.search}%`),
    );
    if (search) objectiveFilters.push(search);
  }

  const [tracks, curriculumRows, subjectRows, objectiveRows] = await Promise.all([
    db.select().from(contentTracks).where(eq(contentTracks.isActive, true)).orderBy(asc(contentTracks.id)),
    db.select().from(curricula).where(and(...curriculumFilters)).orderBy(asc(curricula.code)),
    db.select().from(subjects).where(and(...subjectFilters)).orderBy(asc(subjects.name)),
    db.select().from(learningObjectives).where(and(...objectiveFilters)).orderBy(asc(learningObjectives.gradeLabel), asc(learningObjectives.subjectCode), asc(learningObjectives.topic)).limit(100),
  ]);

  return { tracks, curricula: curriculumRows, subjects: subjectRows, learningObjectives: objectiveRows };
}

export async function createCurriculum(currentUser: User, input: CurriculumCreateInput) {
  await requireTaxonomyWriteAccess(currentUser, input.organizationId);

  const [created] = await db
    .insert(curricula)
    .values({
      code: input.code,
      name: input.name,
      track: input.track,
      organizationId: input.organizationId ?? null,
      source: input.organizationId ? "organization" : input.source,
      regions: input.regions,
      characteristics: input.characteristics,
      metadata: input.metadata,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: currentUser.id,
    organizationId: input.organizationId ?? null,
    action: "curriculum.created",
    entityType: "curriculum",
    entityId: created.id,
  });

  return created;
}

export async function createLearningObjective(currentUser: User, input: LearningObjectiveCreateInput) {
  await requireTaxonomyWriteAccess(currentUser, input.organizationId);

  const [created] = await db
    .insert(learningObjectives)
    .values({
      objectiveId: input.objectiveId,
      organizationId: input.organizationId ?? null,
      track: input.track,
      curriculumCode: input.curriculumCode,
      levelCode: input.levelCode,
      gradeLabel: input.gradeLabel,
      subjectCode: input.subjectCode,
      topic: input.topic,
      objective: input.objective,
      bloomTaxonomy: input.bloomTaxonomy,
      assessmentTypes: input.assessmentTypes,
      keywords: input.keywords,
      prerequisites: input.prerequisites,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: currentUser.id,
    organizationId: input.organizationId ?? null,
    action: "learning_objective.created",
    entityType: "learning_objective",
    entityId: created.id,
  });

  return created;
}

function previousGradeLabels(gradeLabel?: string) {
  if (!gradeLabel) return [];
  const numberMatch = gradeLabel.match(/(\d+)/);
  if (!numberMatch) return [gradeLabel];
  const grade = Number(numberMatch[1]);
  const prefix = gradeLabel.slice(0, numberMatch.index).trim() || "Kelas";
  const labels = [grade - 2, grade - 1, grade].filter((value) => value > 0).map((value) => `${prefix} ${value}`.trim());
  return [...new Set([...labels, gradeLabel])];
}

async function getPlacementObjectives(input: PlacementStartInput) {
  if (input.track !== "SCH") return [];
  const filters: SQL<unknown>[] = [eq(learningObjectives.track, "SCH"), eq(learningObjectives.isActive, true)];
  const tenantScope = input.organizationId
    ? or(
        isNull(learningObjectives.organizationId),
        eq(learningObjectives.organizationId, input.organizationId),
      )
    : isNull(learningObjectives.organizationId);
  if (tenantScope) filters.push(tenantScope);
  if (input.curriculumCode) filters.push(eq(learningObjectives.curriculumCode, input.curriculumCode));
  if (input.levelCode) filters.push(eq(learningObjectives.levelCode, input.levelCode));
  if (input.subjectCode) filters.push(eq(learningObjectives.subjectCode, input.subjectCode));
  const grades = previousGradeLabels(input.gradeLabel);
  if (grades.length > 0) filters.push(inArray(learningObjectives.gradeLabel, grades));

  return db.select().from(learningObjectives).where(and(...filters)).orderBy(asc(learningObjectives.gradeLabel), asc(learningObjectives.topic)).limit(8);
}

function buildPlacementQuestions(input: PlacementStartInput, objectiveRows: Awaited<ReturnType<typeof getPlacementObjectives>>) {
  if (input.track === "SCH") {
    return objectiveRows.map((objective, index) => ({
      id: `q-${index + 1}`,
      learningObjectiveId: objective.id,
      prompt: `Show your understanding: ${objective.objective}`,
      topic: objective.topic,
      expectedKeywords: objective.keywords,
    }));
  }

  const framework = input.skillFramework || (input.track === "LNG" ? "CEFR" : "Industry Benchmark");
  return ["baseline", "application", "reflection"].map((topic, index) => ({
    id: `q-${index + 1}`,
    learningObjectiveId: null,
    prompt: `Answer a ${framework} ${topic} question for ${input.subjectCode || input.track}: describe your current ability and give one concrete example.`,
    topic,
    expectedKeywords: [input.subjectCode, framework].filter(Boolean),
  }));
}

export async function startPlacementTest(currentUser: User, input: PlacementStartInput) {
  if (input.organizationId) {
    const membership = await getOrganizationMembership(currentUser.id, input.organizationId);
    if (!membership) throw new AppError("FORBIDDEN", "You cannot access this organization placement flow", 403);
  }
  if (input.courseId) {
    const detail = await getCourseDetail(currentUser, input.courseId);
    if (input.organizationId && detail.course.organizationId !== input.organizationId) {
      throw new AppError("VALIDATION_ERROR", "Course and placement organization must match", 400);
    }
  }

  const scope = input.track === "SCH" ? "strict_lo_scope" : "open_proficiency";
  if (input.track === "SCH" && (!input.curriculumCode || !input.gradeLabel || !input.subjectCode)) {
    throw new AppError("VALIDATION_ERROR", "School placement requires curriculum, grade, and subject", 400);
  }

  const objectiveRows = await getPlacementObjectives(input);
  const questions = buildPlacementQuestions(input, objectiveRows);
  if (questions.length === 0) {
    throw new AppError("NOT_FOUND", "No placement questions are available for this scope", 404);
  }

  const [test] = await db.insert(placementTests).values({
    userId: currentUser.id,
    organizationId: input.organizationId ?? null,
    courseId: input.courseId,
    track: input.track,
    curriculumCode: input.curriculumCode,
    levelCode: input.levelCode,
    gradeLabel: input.gradeLabel,
    subjectCode: input.subjectCode,
    skillFramework: input.skillFramework,
    scope,
    report: { questions, rule: scope === "strict_lo_scope" ? "Curriculum LO scope only" : "Open proficiency framework" },
  }).returning();

  return { test, questions };
}

function scorePlacementAnswer(answer: string, expectedKeywords: string[]) {
  const normalized = answer.toLowerCase();
  const matches = expectedKeywords.filter((keyword) => normalized.includes(String(keyword).toLowerCase())).length;
  const lengthScore = Math.min(70, Math.round(answer.length / 8));
  return Math.min(100, Math.max(35, lengthScore + matches * 10));
}

export async function submitPlacementTest(currentUser: User, placementTestId: string, input: PlacementSubmitInput) {
  const [test] = await db.select().from(placementTests).where(and(eq(placementTests.id, placementTestId), eq(placementTests.userId, currentUser.id))).limit(1);
  if (!test) throw new AppError("NOT_FOUND", "Placement test not found", 404);

  const objectiveIds = input.answers.map((answer) => answer.learningObjectiveId).filter((id): id is string => Boolean(id));
  const objectiveRows = objectiveIds.length > 0
    ? await db.select().from(learningObjectives).where(inArray(learningObjectives.id, objectiveIds))
    : [];
  const objectiveMap = new Map(objectiveRows.map((objective) => [objective.id, objective]));

  const scored = input.answers.map((answer) => {
    const objective = answer.learningObjectiveId ? objectiveMap.get(answer.learningObjectiveId) : undefined;
    const expectedKeywords = objective?.keywords ?? [test.subjectCode, test.skillFramework].filter((value): value is string => Boolean(value));
    const score = scorePlacementAnswer(answer.answer, expectedKeywords);
    return {
      ...answer,
      score,
      isCorrect: score >= 70,
      feedback: score >= 70 ? "Shows sufficient mastery for this checkpoint." : "Needs remediation before moving deeper into this path.",
    };
  });

  const average = Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length);
  const recommendedLevel = average >= 85 ? "advanced" : average >= 70 ? "intermediate" : "remediation";

  return db.transaction(async (tx) => {
    await tx.insert(placementResponses).values(scored.map((answer) => ({
      placementTestId: test.id,
      learningObjectiveId: answer.learningObjectiveId ?? null,
      question: answer.question,
      answer: answer.answer,
      isCorrect: answer.isCorrect,
      score: answer.score,
      feedback: answer.feedback,
    })));

    const [updated] = await tx.update(placementTests).set({
      status: "scored",
      score: average,
      recommendedLevel,
      report: {
        ...(typeof test.report === "object" && test.report !== null ? test.report : {}),
        average,
        recommendedLevel,
        mastery: scored.map((row) => ({ question: row.question, score: row.score, isCorrect: row.isCorrect })),
      },
      updatedAt: new Date(),
    }).where(eq(placementTests.id, test.id)).returning();

    await tx.insert(notifications).values({
      userId: currentUser.id,
      type: "assessment",
      title: "Placement test scored",
      body: `Your placement result is ${average}% with ${recommendedLevel} recommendation.`,
      actionUrl: "/dashboard/placement",
    });

    return { test: updated, responses: scored };
  });
}

export async function listPlacementTests(currentUser: User) {
  return db.select().from(placementTests).where(eq(placementTests.userId, currentUser.id)).orderBy(desc(placementTests.createdAt));
}

async function assertContentAssetAccess(currentUser: User, organizationId?: string | null) {
  if (organizationId) {
    const membership = await getOrganizationMembership(currentUser.id, organizationId);
    if (!membership || !isOrgManagerRole(membership.role)) {
      throw new AppError("FORBIDDEN", "You cannot manage assets for this organization", 403);
    }
    return;
  }
  const admin = await getAppAdmin(currentUser.id);
  if (!admin || !["owner", "content"].includes(admin.role)) {
    throw new AppError("FORBIDDEN", "Platform content access is required", 403);
  }
}

export async function listContentAssets(currentUser: User | null) {
  const accessRules: SQL<unknown>[] = [and(isNull(contentAssets.organizationId), eq(contentAssets.status, "published"))!];
  if (currentUser) {
    const orgIds = await getUserOrganizationIds(currentUser.id);
    accessRules.push(eq(contentAssets.ownerId, currentUser.id));
    if (orgIds.length > 0) accessRules.push(inArray(contentAssets.organizationId, orgIds));
    const admin = await getAppAdmin(currentUser.id);
    if (admin && ["owner", "content"].includes(admin.role)) accessRules.push(isNull(contentAssets.organizationId));
  }

  const where = or(...accessRules);
  return db.select().from(contentAssets).where(where).orderBy(desc(contentAssets.updatedAt)).limit(100);
}

export async function createContentAsset(currentUser: User, input: ContentAssetCreateInput) {
  await assertContentAssetAccess(currentUser, input.organizationId);
  const [asset] = await db.insert(contentAssets).values({
    organizationId: input.organizationId ?? null,
    ownerId: currentUser.id,
    title: input.title,
    description: input.description,
    kind: input.kind,
    status: input.status,
    sourceUrl: input.sourceUrl || null,
    tags: input.tags,
    metadata: input.metadata,
  }).returning();
  return asset;
}

export async function listPersonalLibrary(currentUser: User) {
  return db
    .select({
      id: personalLibraryItems.id,
      notes: personalLibraryItems.notes,
      tags: personalLibraryItems.tags,
      createdAt: personalLibraryItems.createdAt,
      courseId: courses.id,
      courseTitle: courses.title,
      assetId: contentAssets.id,
      assetTitle: contentAssets.title,
      assetKind: contentAssets.kind,
    })
    .from(personalLibraryItems)
    .leftJoin(courses, eq(courses.id, personalLibraryItems.courseId))
    .leftJoin(contentAssets, eq(contentAssets.id, personalLibraryItems.assetId))
    .where(eq(personalLibraryItems.userId, currentUser.id))
    .orderBy(desc(personalLibraryItems.createdAt));
}

export async function addPersonalLibraryItem(currentUser: User, input: PersonalLibraryCreateInput) {
  if (input.courseId) {
    await getCourseDetail(currentUser, input.courseId);
  }
  if (input.assetId) {
    const assets = await listContentAssets(currentUser);
    if (!assets.some((asset) => asset.id === input.assetId)) throw new AppError("FORBIDDEN", "You cannot save this asset", 403);
  }
  const [item] = await db.insert(personalLibraryItems).values({
    userId: currentUser.id,
    courseId: input.courseId ?? null,
    assetId: input.assetId ?? null,
    notes: input.notes,
    tags: input.tags,
  }).returning();
  return item;
}

export async function listDiscussions(currentUser: User) {
  const orgIds = await getUserOrganizationIds(currentUser.id);
  const accessRules: SQL<unknown>[] = [eq(discussionThreads.createdById, currentUser.id)];
  if (orgIds.length > 0) {
    const tenantDiscussion = and(
      inArray(discussionThreads.organizationId, orgIds),
      inArray(discussionThreads.visibility, ["course", "organization"]),
    );
    if (tenantDiscussion) accessRules.push(tenantDiscussion);
  }

  return db
    .select({
      id: discussionThreads.id,
      title: discussionThreads.title,
      visibility: discussionThreads.visibility,
      status: discussionThreads.status,
      organizationId: discussionThreads.organizationId,
      courseId: discussionThreads.courseId,
      createdAt: discussionThreads.createdAt,
      authorName: users.name,
    })
    .from(discussionThreads)
    .innerJoin(users, eq(users.id, discussionThreads.createdById))
    .where(or(...accessRules))
    .orderBy(desc(discussionThreads.updatedAt));
}

export async function createDiscussion(currentUser: User, input: DiscussionCreateInput) {
  if (input.organizationId) {
    const membership = await getOrganizationMembership(currentUser.id, input.organizationId);
    if (!membership) throw new AppError("FORBIDDEN", "You cannot create discussions in this organization", 403);
  }
  if (input.courseId) {
    const detail = await getCourseDetail(currentUser, input.courseId);
    if (input.organizationId && detail.course.organizationId !== input.organizationId) {
      throw new AppError("VALIDATION_ERROR", "Course and discussion organization must match", 400);
    }
    if (input.visibility === "organization" && !input.organizationId) {
      throw new AppError("VALIDATION_ERROR", "Organization discussions require an organization", 400);
    }
  }

  return db.transaction(async (tx) => {
    const [thread] = await tx.insert(discussionThreads).values({
      organizationId: input.organizationId ?? null,
      courseId: input.courseId ?? null,
      createdById: currentUser.id,
      title: input.title,
      visibility: input.visibility,
    }).returning();

    const [post] = await tx.insert(discussionPosts).values({
      threadId: thread.id,
      authorId: currentUser.id,
      content: input.content,
    }).returning();

    return { thread, post };
  });
}

export async function addDiscussionPost(currentUser: User, threadId: string, input: DiscussionPostCreateInput) {
  const [thread] = await db.select().from(discussionThreads).where(eq(discussionThreads.id, threadId)).limit(1);
  if (!thread) throw new AppError("NOT_FOUND", "Discussion thread not found", 404);
  if (thread.visibility === "private" && thread.createdById !== currentUser.id) {
    throw new AppError("FORBIDDEN", "You cannot post in this private discussion", 403);
  }
  if (thread.organizationId) {
    const membership = await getOrganizationMembership(currentUser.id, thread.organizationId);
    if (!membership) throw new AppError("FORBIDDEN", "You cannot post in this discussion", 403);
  }
  if (thread.courseId) await getCourseDetail(currentUser, thread.courseId);
  const [post] = await db.insert(discussionPosts).values({
    threadId,
    authorId: currentUser.id,
    content: input.content,
  }).returning();
  return post;
}

export async function listNotifications(currentUser: User) {
  return db.select().from(notifications).where(eq(notifications.userId, currentUser.id)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function markNotificationsRead(currentUser: User, ids: string[]) {
  return db.update(notifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(eq(notifications.userId, currentUser.id), inArray(notifications.id, ids))).returning();
}

export async function getPlatformConfiguration(currentUser: User) {
  const admin = await getAppAdmin(currentUser.id);
  if (!admin) throw new AppError("FORBIDDEN", "Application owner access is required", 403);
  const [taxonomy, assetRows] = await Promise.all([listTaxonomy({}, currentUser), listContentAssets(currentUser)]);
  const organizationRows = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(50);
  return { taxonomy, assets: assetRows, organizations: organizationRows };
}
