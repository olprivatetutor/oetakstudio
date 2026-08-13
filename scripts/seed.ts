import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/security/password";
import { db } from "@/db";
import { account, user } from "@/db/schema/auth";
import {
  membershipRoles,
  roles,
  workspaceMemberships,
  workspaces,
} from "@/db/schema/workspace";
import {
  assessments,
  courseModules,
  courses,
  learnerProfiles,
  organizationMembers,
  organizations,
  appAdmins,
  subscriptions,
  contentTracks,
  curricula,
  subjects,
  learningObjectives,
  courseLearningObjectives,
  contentAssets,
  notifications,
  enrollments,
  moduleProgress,
  placementTests,
  placementResponses,
  discussionThreads,
  discussionPosts,
  personalLibraryItems,
} from "@/db/schema/learning";

const now = new Date();
const demoUserId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
// §4.4: one Organization Workspace per organization. organizations.workspace_id
// is NOT NULL since migration 0011, so every seeded org needs one. Fixed ids
// keep the seed idempotent (§14: seed data is versioned and idempotent).
const orgWorkspaceId = "22222222-2222-4222-8222-2222222222w1";
const maintenanceOrgWorkspaceId = "99999999-9999-4999-8999-9999999999w1";
const scenarioOrgWorkspaceId = "10101010-1111-4111-8111-10101010w001";
const englishSchoolOrgWorkspaceId = "71717171-1111-4111-8111-71717171w001";
const maintenanceUserId = "99999999-9999-4999-8999-999999999991";
const maintenanceAccountId = "99999999-9999-4999-8999-999999999992";
const maintenanceOrgId = "99999999-9999-4999-8999-999999999993";
const contentManagerUserId = "99999999-9999-4999-8999-999999999996";
const contentManagerAccountId = "99999999-9999-4999-8999-999999999997";
const maintenanceSubscriptionId = "99999999-9999-4999-8999-999999999994";
const demoOrgSubscriptionId = "99999999-9999-4999-8999-999999999995";
const maintenanceEmail = process.env.MAINTENANCE_OWNER_EMAIL ?? "owner@oetakstudio.local";
const maintenancePassword = process.env.MAINTENANCE_OWNER_PASSWORD ?? "Owner@2026!";
const contentManagerEmail = process.env.CONTENT_MANAGER_EMAIL ?? "content@oetakstudio.local";
const contentManagerPassword = process.env.CONTENT_MANAGER_PASSWORD ?? "Content@2026!";

const scenarioPassword = process.env.SCENARIO_1_PASSWORD ?? "Scenario@2026!";
const scenarioOrgId = "10101010-1111-4111-8111-101010101001";
const scenarioOwnerUserId = "10101010-1111-4111-8111-101010101011";
const scenarioOwnerAccountId = "10101010-1111-4111-8111-101010101012";
const scenarioAdminUserId = "10101010-1111-4111-8111-101010101021";
const scenarioAdminAccountId = "10101010-1111-4111-8111-101010101022";
const scenarioTeacherUserId = "10101010-1111-4111-8111-101010101031";
const scenarioTeacherAccountId = "10101010-1111-4111-8111-101010101032";
const scenarioStudentUserId = "10101010-1111-4111-8111-101010101041";
const scenarioStudentAccountId = "10101010-1111-4111-8111-101010101042";
const scenarioParentUserId = "10101010-1111-4111-8111-101010101051";
const scenarioParentAccountId = "10101010-1111-4111-8111-101010101052";
const scenarioCourseId = "10101010-2222-4222-8222-101010101001";
const scenarioModuleIds = [
  "10101010-3333-4333-8333-101010101001",
  "10101010-3333-4333-8333-101010101002",
  "10101010-3333-4333-8333-101010101003",
] as const;
const scenarioAssessmentId = "10101010-4444-4444-8444-101010101001";
const scenarioEnrollmentId = "10101010-5555-4555-8555-101010101001";
const scenarioPlacementId = "10101010-6666-4666-8666-101010101001";
const scenarioDiscussionId = "10101010-7777-4777-8777-101010101001";

const englishGrade7CourseId = "70707070-1111-4111-8111-707070707001";
const englishGrade7ModuleIds = [
  "70707070-2222-4222-8222-707070707001",
  "70707070-2222-4222-8222-707070707002",
  "70707070-2222-4222-8222-707070707003",
  "70707070-2222-4222-8222-707070707004",
  "70707070-2222-4222-8222-707070707005",
  "70707070-2222-4222-8222-707070707006",
] as const;
const englishGrade7ObjectiveIds = [
  "70707070-3333-4333-8333-707070707001",
  "70707070-3333-4333-8333-707070707002",
  "70707070-3333-4333-8333-707070707003",
  "70707070-3333-4333-8333-707070707004",
  "70707070-3333-4333-8333-707070707005",
  "70707070-3333-4333-8333-707070707006",
] as const;
const englishGrade7AssetIds = [
  "70707070-4444-4444-8444-707070707001",
  "70707070-4444-4444-8444-707070707002",
  "70707070-4444-4444-8444-707070707003",
  "70707070-4444-4444-8444-707070707004",
  "70707070-4444-4444-8444-707070707005",
  "70707070-4444-4444-8444-707070707006",
] as const;
const englishGrade7AssessmentId = "70707070-5555-4555-8555-707070707001";

const englishSchoolPassword = process.env.ENGLISH_SCHOOL_PASSWORD ?? "English@2026!";
const englishSchoolOrgId = "71717171-1111-4111-8111-717171717001";
const englishSchoolOwnerUserId = "71717171-1111-4111-8111-717171717011";
const englishSchoolOwnerAccountId = "71717171-1111-4111-8111-717171717012";
const englishSchoolAdminUserId = "71717171-1111-4111-8111-717171717021";
const englishSchoolAdminAccountId = "71717171-1111-4111-8111-717171717022";
const englishSchoolTeacherUserId = "71717171-1111-4111-8111-717171717031";
const englishSchoolTeacherAccountId = "71717171-1111-4111-8111-717171717032";
const englishSchoolStudentUserId = "71717171-1111-4111-8111-717171717041";
const englishSchoolStudentAccountId = "71717171-1111-4111-8111-717171717042";
const englishSchoolEnrollmentId = "71717171-5555-4555-8555-717171717001";

const demoCourses = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    title: "Adaptive Trigonometry Foundations",
    slug: "adaptive-trigonometry-foundations",
    description: "A personalized path for high school learners covering ratios, unit circle intuition, and applied problem solving with checkpoints.",
    category: "Mathematics",
    level: "beginner" as const,
    estimatedMinutes: 95,
    modules: [
      {
        id: "44444444-4444-4444-8444-444444444441",
        title: "Trigonometric ratios",
        summary: "Connect sine, cosine, and tangent to right-triangle relationships.",
        type: "interactive" as const,
        content: "Study how side ratios describe angles. Try drawing three similar triangles and compare their side ratios to see why the ratios stay stable.",
        estimatedMinutes: 30,
      },
      {
        id: "44444444-4444-4444-8444-444444444442",
        title: "Unit circle intuition",
        summary: "Translate triangle ratios into coordinates on a circle.",
        type: "reading" as const,
        content: "The unit circle turns trigonometry into coordinate movement. Focus on how x maps to cosine and y maps to sine for common angles.",
        estimatedMinutes: 35,
      },
      {
        id: "44444444-4444-4444-8444-444444444443",
        title: "Applied practice",
        summary: "Solve height, distance, and angle problems using structured reasoning.",
        type: "assignment" as const,
        content: "Pick two real-world height or distance problems. Define the known sides, choose the ratio, solve, and explain why the ratio fits.",
        estimatedMinutes: 30,
      },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    title: "IELTS Writing Band Builder",
    slug: "ielts-writing-band-builder",
    description: "A focused IELTS writing course with rubric-driven practice, self-review, and AI-modeled feedback loops for Task 1 and Task 2.",
    category: "Language",
    level: "intermediate" as const,
    estimatedMinutes: 120,
    modules: [
      {
        id: "44444444-4444-4444-8444-444444444451",
        title: "Task achievement",
        summary: "Understand how to answer the prompt directly and completely.",
        type: "reading" as const,
        content: "Break the prompt into instruction, topic, and scope. Your first checkpoint is whether each body paragraph answers the exact instruction.",
        estimatedMinutes: 40,
      },
      {
        id: "44444444-4444-4444-8444-444444444452",
        title: "Coherence and cohesion",
        summary: "Build paragraphs with clear claims, examples, and transitions.",
        type: "interactive" as const,
        content: "Practice paragraph planning with a claim, reason, example, and implication. Keep linking words natural and avoid over-signposting.",
        estimatedMinutes: 40,
      },
      {
        id: "44444444-4444-4444-8444-444444444453",
        title: "Lexical and grammar range",
        summary: "Improve vocabulary precision and sentence control without memorized templates.",
        type: "assignment" as const,
        content: "Rewrite one paragraph using more precise verbs, varied sentence openings, and error checks for articles and agreement.",
        estimatedMinutes: 40,
      },
    ],
  },
];

async function upsertCredentialUser(input: {
  userId: string;
  accountId: string;
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);

  await db.insert(user).values({
    id: input.userId,
    name: input.name,
    email: input.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: user.id,
    set: {
      name: input.name,
      email: input.email,
      emailVerified: true,
      updatedAt: now,
    },
  });

  await db.insert(account).values({
    id: input.accountId,
    accountId: input.userId,
    providerId: "credential",
    userId: input.userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: account.id,
    set: {
      accountId: input.userId,
      providerId: "credential",
      userId: input.userId,
      password: passwordHash,
      updatedAt: now,
    },
  });
}

/**
 * Provisions the Organization Workspace a seeded organization requires (§4.4),
 * with its founding ORG_OWNER membership. Mirrors the backfill in migration 0011
 * (`workspaces.slug = 'org-' || organizations.slug`) so seeded and migrated
 * tenants are indistinguishable. Idempotent: every write conflicts to no-op.
 *
 * The seed runs on the owner connection, so RLS is not the control here — this
 * exists to satisfy the NOT NULL FK and to give seeded orgs a real membership
 * graph, matching what lib/services/workspace.ts creates at runtime.
 */
async function seedOrganizationWorkspace(input: {
  workspaceId: string;
  name: string;
  organizationSlug: string;
  ownerUserId: string;
}) {
  await db
    .insert(workspaces)
    .values({
      id: input.workspaceId,
      type: "ORGANIZATION",
      name: input.name,
      slug: `org-${input.organizationSlug}`,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const membershipId = `${input.workspaceId}-owner`;
  await db
    .insert(workspaceMemberships)
    .values({
      id: membershipId,
      workspaceId: input.workspaceId,
      userId: input.ownerUserId,
      status: "ACTIVE",
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const [ownerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, "ORG_OWNER"));
  if (ownerRole) {
    await db
      .insert(membershipRoles)
      .values({ membershipId, roleId: ownerRole.id, grantedAt: now })
      .onConflictDoNothing();
  }
}

async function main() {
  const maintenancePasswordHash = await hashPassword(maintenancePassword);
  const contentManagerPasswordHash = await hashPassword(contentManagerPassword);

  await db.insert(user).values({
    id: maintenanceUserId,
    name: "Maintenance Owner",
    email: maintenanceEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: user.id,
    set: {
      name: "Maintenance Owner",
      email: maintenanceEmail,
      emailVerified: true,
      updatedAt: now,
    },
  });

  await db.insert(account).values({
    id: maintenanceAccountId,
    accountId: maintenanceUserId,
    providerId: "credential",
    userId: maintenanceUserId,
    password: maintenancePasswordHash,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: account.id,
    set: {
      accountId: maintenanceUserId,
      providerId: "credential",
      userId: maintenanceUserId,
      password: maintenancePasswordHash,
      updatedAt: now,
    },
  });

  await db.insert(appAdmins).values({
    userId: maintenanceUserId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: appAdmins.userId,
    set: {
      role: "owner",
      status: "active",
      updatedAt: now,
    },
  });

  await db.insert(user).values({
    id: contentManagerUserId,
    name: "Content Manager",
    email: contentManagerEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: user.id,
    set: {
      name: "Content Manager",
      email: contentManagerEmail,
      emailVerified: true,
      updatedAt: now,
    },
  });

  await db.insert(account).values({
    id: contentManagerAccountId,
    accountId: contentManagerUserId,
    providerId: "credential",
    userId: contentManagerUserId,
    password: contentManagerPasswordHash,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: account.id,
    set: {
      accountId: contentManagerUserId,
      providerId: "credential",
      userId: contentManagerUserId,
      password: contentManagerPasswordHash,
      updatedAt: now,
    },
  });

  await db.insert(appAdmins).values({
    userId: contentManagerUserId,
    role: "content",
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: appAdmins.userId,
    set: {
      role: "content",
      status: "active",
      updatedAt: now,
    },
  });

  await db.insert(learnerProfiles).values({
    userId: maintenanceUserId,
    accountType: "organization",
    headline: "Application maintenance owner",
    goals: ["Maintain application content", "Monitor organization learning operations"],
    interests: ["Platform operations", "Course quality", "Learning analytics"],
    proficiencyLevel: "advanced",
    targetStudyMinutes: 300,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: learnerProfiles.userId,
    set: {
      accountType: "organization",
      headline: "Application maintenance owner",
      goals: ["Maintain application content", "Monitor organization learning operations"],
      interests: ["Platform operations", "Course quality", "Learning analytics"],
      proficiencyLevel: "advanced",
      targetStudyMinutes: 300,
      updatedAt: now,
    },
  });

  await seedOrganizationWorkspace({
    workspaceId: maintenanceOrgWorkspaceId,
    name: "Oetak Studio Maintenance",
    organizationSlug: "oetak-studio-maintenance",
    ownerUserId: maintenanceUserId,
  });

  await db.insert(organizations).values({
    id: maintenanceOrgId,
    workspaceId: maintenanceOrgWorkspaceId,
    name: "Oetak Studio Maintenance",
    slug: "oetak-studio-maintenance",
    description: "Maintenance tenant for application operations and owner-level access.",
    ownerId: maintenanceUserId,
    type: "institution",
    primaryContentTrack: "PRO",
    curriculumMode: "inherited",
    brandColor: "#274029",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: organizations.id,
    set: {
      name: "Oetak Studio Maintenance",
      slug: "oetak-studio-maintenance",
      description: "Maintenance tenant for application operations and owner-level access.",
      ownerId: maintenanceUserId,
      type: "institution",
      primaryContentTrack: "PRO",
      curriculumMode: "inherited",
      brandColor: "#274029",
      updatedAt: now,
    },
  });

  await db.insert(organizationMembers).values({
    organizationId: maintenanceOrgId,
    userId: maintenanceUserId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [organizationMembers.organizationId, organizationMembers.userId],
    set: {
      role: "owner",
      status: "active",
      updatedAt: now,
    },
  });

  await db.insert(subscriptions).values({
    id: maintenanceSubscriptionId,
    subjectType: "organization",
    subjectId: maintenanceOrgId,
    plan: "enterprise",
    status: "active",
    seats: 5,
    billingEmail: maintenanceEmail,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    notes: "Internal maintenance tenant for application owner operations.",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: subscriptions.id,
    set: {
      subjectType: "organization",
      subjectId: maintenanceOrgId,
      plan: "enterprise",
      status: "active",
      seats: 5,
      billingEmail: maintenanceEmail,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      notes: "Internal maintenance tenant for application owner operations.",
      updatedAt: now,
    },
  });

  await db.insert(user).values({
    id: demoUserId,
    name: "Demo Course Owner",
    email: "demo-owner@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(learnerProfiles).values({
    userId: demoUserId,
    accountType: "organization",
    headline: "Seed owner for demo catalog",
    goals: ["Create adaptive courses", "Track learner progress"],
    interests: ["AI tutoring", "Learning analytics"],
    proficiencyLevel: "advanced",
    targetStudyMinutes: 180,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await seedOrganizationWorkspace({
    workspaceId: orgWorkspaceId,
    name: "Tech Academy Demo",
    organizationSlug: "tech-academy-demo",
    ownerUserId: demoUserId,
  });

  await db.insert(organizations).values({
    id: orgId,
    workspaceId: orgWorkspaceId,
    name: "Tech Academy Demo",
    slug: "tech-academy-demo",
    description: "Sample tenant for course ownership and organization analytics.",
    ownerId: demoUserId,
    type: "school",
    primaryContentTrack: "SCH",
    curriculumMode: "inherited",
    brandColor: "#2563eb",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId: demoUserId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(subscriptions).values({
    id: demoOrgSubscriptionId,
    subjectType: "organization",
    subjectId: orgId,
    plan: "professional",
    status: "trialing",
    seats: 25,
    billingEmail: "billing@tech-academy-demo.local",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    notes: "Demo tenant subscription for app owner administration.",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: subscriptions.id,
    set: {
      subjectType: "organization",
      subjectId: orgId,
      plan: "professional",
      status: "trialing",
      seats: 25,
      billingEmail: "billing@tech-academy-demo.local",
      currentPeriodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      notes: "Demo tenant subscription for app owner administration.",
      updatedAt: now,
    },
  });


  const trackSeeds = [
    ["SCH", "Formal School", "Academic content aligned with formal education curricula", "K-12 students, teachers, and schools"],
    ["ESP", "English for Specific Purposes", "Contextual English for professional fields", "Business, medical, legal, and specialist learners"],
    ["LNP", "Language Test Preparation", "Preparation for recognized language proficiency exams", "IELTS, TOEFL, JLPT, HSK, DELF, and Goethe test takers"],
    ["LNG", "General Language Learning", "Everyday language learning aligned to proficiency frameworks", "Independent and organization learners"],
    ["PRO", "Professional Skills", "Career-oriented skill development", "Working professionals and career changers"],
    ["GEN", "General Enrichment", "Lifelong learning and personal interest", "All learners"],
  ] as const;

  for (const [id, name, description, targetAudience] of trackSeeds) {
    await db.insert(contentTracks).values({ id, name, description, targetAudience, createdAt: now, updatedAt: now }).onConflictDoUpdate({
      target: contentTracks.id,
      set: { name, description, targetAudience, isActive: true, updatedAt: now },
    });
  }

  const curriculumSeeds = [
    { id: "66666666-6666-4666-8666-666666666601", code: "MER", name: "Kurikulum Merdeka", regions: ["Indonesia"], characteristics: "Competency-based, flexible, project-based" },
    { id: "66666666-6666-4666-8666-666666666602", code: "CAM", name: "Cambridge Curriculum", regions: ["International"], characteristics: "IGCSE, A-Level, inquiry-based" },
    { id: "66666666-6666-4666-8666-666666666603", code: "IB", name: "International Baccalaureate", regions: ["International"], characteristics: "Holistic, international-mindedness" },
    { id: "66666666-6666-4666-8666-666666666604", code: "SGP", name: "Singapore Curriculum", regions: ["Singapore", "International"], characteristics: "Math/Science excellence, problem-solving" },
    { id: "66666666-6666-4666-8666-666666666605", code: "AUS", name: "Australian Curriculum", regions: ["Australia", "International"], characteristics: "Cross-curriculum priorities" },
    { id: "66666666-6666-4666-8666-666666666606", code: "USCC", name: "US Common Core", regions: ["United States", "International"], characteristics: "Standards-based, college/career readiness" },
  ];

  for (const curriculum of curriculumSeeds) {
    await db.insert(curricula).values({ ...curriculum, track: "SCH", source: "system", organizationId: null, metadata: {}, createdAt: now, updatedAt: now }).onConflictDoUpdate({
      target: curricula.id,
      set: { name: curriculum.name, regions: curriculum.regions, characteristics: curriculum.characteristics, updatedAt: now },
    });
  }

  const subjectSeeds = [
    { id: "77777777-7777-4777-8777-777777777701", code: "MATH", name: "Mathematics", track: "SCH" as const, keyTopics: ["Numbers", "Algebra", "Geometry", "Statistics", "Calculus"] },
    { id: "77777777-7777-4777-8777-777777777702", code: "SCI", name: "Science", track: "SCH" as const, keyTopics: ["Physics", "Chemistry", "Biology", "Earth Science"] },
    { id: "77777777-7777-4777-8777-777777777703", code: "ENG", name: "English", track: "SCH" as const, keyTopics: ["Reading", "Writing", "Speaking", "Literature"] },
    { id: "77777777-7777-4777-8777-777777777704", code: "ARB", name: "Arabic", track: "SCH" as const, keyTopics: ["Reading", "Writing", "Speaking", "Grammar"] },
    { id: "77777777-7777-4777-8777-777777777705", code: "CS", name: "Computer Science", track: "PRO" as const, keyTopics: ["Programming", "Digital Literacy", "ICT"] },
  ];

  for (const subject of subjectSeeds) {
    await db.insert(subjects).values({ ...subject, description: subject.name + " learning domain", createdAt: now, updatedAt: now }).onConflictDoUpdate({
      target: subjects.id,
      set: { name: subject.name, track: subject.track, keyTopics: subject.keyTopics, updatedAt: now },
    });
  }

  const objectiveSeeds = [
    { id: "88888888-8888-4888-8888-888888888801", objectiveId: "LO-MATH-7-001", curriculumCode: "MER", levelCode: "SMP", gradeLabel: "Kelas 7", subjectCode: "MATH", topic: "Integers", objective: "Apply addition and subtraction of positive and negative integers", bloomTaxonomy: "Applying", keywords: ["integers", "addition", "subtraction"] },
    { id: "88888888-8888-4888-8888-888888888802", objectiveId: "LO-MATH-7-002", curriculumCode: "MER", levelCode: "SMP", gradeLabel: "Kelas 7", subjectCode: "MATH", topic: "Fractions", objective: "Determine equivalent fractions and simplify fractions", bloomTaxonomy: "Understanding", keywords: ["fractions", "equivalent", "simplify"] },
    { id: "88888888-8888-4888-8888-888888888803", objectiveId: "LO-ENG-8-001", curriculumCode: "MER", levelCode: "SMP", gradeLabel: "Kelas 8", subjectCode: "ENG", topic: "Narrative Text", objective: "Analyze the structure of narrative texts", bloomTaxonomy: "Analyzing", keywords: ["narrative", "orientation", "complication", "resolution"] },
    { id: "88888888-8888-4888-8888-888888888804", objectiveId: "LO-MATH-11-001", curriculumCode: "MER", levelCode: "SMA", gradeLabel: "Kelas 11", subjectCode: "MATH", topic: "Trigonometry", objective: "Determine trigonometric ratios in right triangles", bloomTaxonomy: "Applying", keywords: ["sine", "cosine", "tangent", "ratio"] },
    { id: "88888888-8888-4888-8888-888888888805", objectiveId: "LO-MATH-11-002", curriculumCode: "MER", levelCode: "SMA", gradeLabel: "Kelas 11", subjectCode: "MATH", topic: "Trigonometry", objective: "Use trigonometric identities to solve problems", bloomTaxonomy: "Applying", keywords: ["identity", "trigonometry", "solve"] },
  ];

  for (const objective of objectiveSeeds) {
    await db.insert(learningObjectives).values({ ...objective, organizationId: null, track: "SCH", assessmentTypes: ["Formative", "Summative"], prerequisites: [], createdAt: now, updatedAt: now }).onConflictDoUpdate({
      target: learningObjectives.id,
      set: { objective: objective.objective, topic: objective.topic, keywords: objective.keywords, updatedAt: now },
    });
  }

  const englishGrade7Objectives = [
    {
      id: englishGrade7ObjectiveIds[0],
      objectiveId: "LO-ENG-7-001",
      curriculumCode: "MER",
      levelCode: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      topic: "Classroom interaction",
      objective: "Use simple English expressions for greetings, classroom routines, clarification, and respectful turn-taking.",
      bloomTaxonomy: "Applying",
      keywords: ["greetings", "classroom language", "clarification", "turn-taking"],
      assessmentTypes: ["Speaking performance", "Observation checklist"],
      prerequisites: ["Basic greetings", "Alphabet and common classroom objects"],
    },
    {
      id: englishGrade7ObjectiveIds[1],
      objectiveId: "LO-ENG-7-002",
      curriculumCode: "MER",
      levelCode: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      topic: "Self and others",
      objective: "Introduce self and others using short spoken and written profiles with accurate personal information and polite questions.",
      bloomTaxonomy: "Creating",
      keywords: ["self introduction", "profile", "personal information", "questions"],
      assessmentTypes: ["Profile card", "Pair interview"],
      prerequisites: ["Subject pronouns", "Be verbs", "Possessive adjectives"],
    },
    {
      id: englishGrade7ObjectiveIds[2],
      objectiveId: "LO-ENG-7-003",
      curriculumCode: "MER",
      levelCode: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      topic: "Describing people and places",
      objective: "Read and compose short descriptive texts about people, school spaces, and familiar objects using clear details.",
      bloomTaxonomy: "Creating",
      keywords: ["descriptive text", "adjectives", "people", "places"],
      assessmentTypes: ["Short paragraph", "Reading response"],
      prerequisites: ["Nouns", "Adjectives", "There is", "There are"],
    },
    {
      id: englishGrade7ObjectiveIds[3],
      objectiveId: "LO-ENG-7-004",
      curriculumCode: "MER",
      levelCode: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      topic: "Daily routines and preferences",
      objective: "Exchange information about routines, schedules, likes, and dislikes using simple present patterns.",
      bloomTaxonomy: "Applying",
      keywords: ["daily routine", "simple present", "likes", "schedule"],
      assessmentTypes: ["Dialogue", "Learning journal"],
      prerequisites: ["Time expressions", "Common verbs", "Adverbs of frequency"],
    },
    {
      id: englishGrade7ObjectiveIds[4],
      objectiveId: "LO-ENG-7-005",
      curriculumCode: "MER",
      levelCode: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      topic: "Instructions and procedures",
      objective: "Understand and produce short instructions or procedure texts for familiar school and home activities.",
      bloomTaxonomy: "Creating",
      keywords: ["procedure", "imperatives", "sequence", "instructions"],
      assessmentTypes: ["Sequencing task", "Procedure poster"],
      prerequisites: ["Action verbs", "Sequence connectors", "Classroom commands"],
    },
    {
      id: englishGrade7ObjectiveIds[5],
      objectiveId: "LO-ENG-7-006",
      curriculumCode: "MER",
      levelCode: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      topic: "Short messages and presentation",
      objective: "Interpret short functional messages and present a simple multimodal project with clear audience awareness.",
      bloomTaxonomy: "Evaluating",
      keywords: ["short message", "announcement", "presentation", "multimodal"],
      assessmentTypes: ["Project presentation", "Peer feedback"],
      prerequisites: ["Key information", "Wh-questions", "Presentation phrases"],
    },
  ];

  for (const objective of englishGrade7Objectives) {
    await db.insert(learningObjectives).values({
      ...objective,
      organizationId: null,
      track: "SCH",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: learningObjectives.id,
      set: {
        objectiveId: objective.objectiveId,
        curriculumCode: objective.curriculumCode,
        levelCode: objective.levelCode,
        gradeLabel: objective.gradeLabel,
        subjectCode: objective.subjectCode,
        topic: objective.topic,
        objective: objective.objective,
        bloomTaxonomy: objective.bloomTaxonomy,
        assessmentTypes: objective.assessmentTypes,
        keywords: objective.keywords,
        prerequisites: objective.prerequisites,
        isActive: true,
        updatedAt: now,
      },
    });
  }

  const englishGrade7Materials = [
    {
      id: englishGrade7AssetIds[0],
      title: "Grade 7 English diagnostic speaking cards",
      description: "Interactive prompt-card set for checking classroom language, introductions, and confidence before learners start the pathway.",
      kind: "interactive" as const,
      tags: ["SCH", "ENG", "MER", "Kelas 7", "diagnostic", "speaking"],
      metadata: {
        curriculum: "MER",
        subject: "ENG",
        grade: "Kelas 7",
        activityType: "speaking-diagnostic",
        estimatedMinutes: 15,
        sourceReference: "documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf",
        prompts: ["greeting exchange", "asking for help", "introducing a friend", "classroom object check"],
      },
    },
    {
      id: englishGrade7AssetIds[1],
      title: "Classroom language listening sprint",
      description: "Audio-style listening sequence blueprint for matching teacher instructions, learner responses, and classroom situations.",
      kind: "audio" as const,
      tags: ["SCH", "ENG", "MER", "Kelas 7", "listening", "classroom"],
      metadata: {
        curriculum: "MER",
        subject: "ENG",
        grade: "Kelas 7",
        activityType: "listen-and-match",
        estimatedMinutes: 20,
        sourceReference: "documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf",
      },
    },
    {
      id: englishGrade7AssetIds[2],
      title: "Personal profile builder",
      description: "H5P-style form flow for building a short profile, interviewing a partner, and revising the profile from peer feedback.",
      kind: "h5p" as const,
      tags: ["SCH", "ENG", "MER", "Kelas 7", "profile", "writing"],
      metadata: {
        curriculum: "MER",
        subject: "ENG",
        grade: "Kelas 7",
        activityType: "guided-writing",
        fields: ["name", "age", "origin", "hobby", "favorite subject", "one learning goal"],
        feedbackRules: ["capitalization", "be verb", "question form", "audience clarity"],
        sourceReference: "documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf",
      },
    },
    {
      id: englishGrade7AssetIds[3],
      title: "Descriptive text reading pack",
      description: "Short original reading pack for identifying topic, details, adjectives, and text purpose in descriptions of familiar school contexts.",
      kind: "document" as const,
      tags: ["SCH", "ENG", "MER", "Kelas 7", "reading", "descriptive"],
      metadata: {
        curriculum: "MER",
        subject: "ENG",
        grade: "Kelas 7",
        activityType: "reading-response",
        readingSkills: ["main idea", "supporting detail", "vocabulary inference", "purpose"],
        sourceReference: "documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf",
      },
    },
    {
      id: englishGrade7AssetIds[4],
      title: "Procedure sequencer interactive",
      description: "Drag-and-order activity blueprint for arranging instructions, selecting imperative verbs, and checking sequence connectors.",
      kind: "h5p" as const,
      tags: ["SCH", "ENG", "MER", "Kelas 7", "procedure", "interactive"],
      metadata: {
        curriculum: "MER",
        subject: "ENG",
        grade: "Kelas 7",
        activityType: "sequence-builder",
        interactionTypes: ["drag-order", "verb-choice", "connector-gap-fill"],
        sourceReference: "documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf",
      },
    },
    {
      id: englishGrade7AssetIds[5],
      title: "Grade 7 English presentation rubric",
      description: "Teacher and peer feedback rubric for a short multimodal presentation using simple English, visuals, and audience-friendly delivery.",
      kind: "template" as const,
      tags: ["SCH", "ENG", "MER", "Kelas 7", "rubric", "presentation"],
      metadata: {
        curriculum: "MER",
        subject: "ENG",
        grade: "Kelas 7",
        criteria: ["message clarity", "language control", "pronunciation", "visual support", "response to feedback"],
        sourceReference: "documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf",
      },
    },
  ];

  for (const material of englishGrade7Materials) {
    await db.insert(contentAssets).values({
      id: material.id,
      organizationId: null,
      ownerId: contentManagerUserId,
      title: material.title,
      description: material.description,
      kind: material.kind,
      status: "published",
      sourceUrl: null,
      tags: material.tags,
      metadata: material.metadata,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: contentAssets.id,
      set: {
        title: material.title,
        description: material.description,
        kind: material.kind,
        status: "published",
        tags: material.tags,
        metadata: material.metadata,
        updatedAt: now,
      },
    });
  }

  const englishGrade7Modules = [
    {
      id: englishGrade7ModuleIds[0],
      title: "Starter diagnostic: English for classroom confidence",
      summary: "Learners use simple greetings, classroom requests, and clarification phrases before starting the pathway.",
      type: "interactive" as const,
      estimatedMinutes: 35,
      content: `Learning focus: classroom interaction and baseline confidence.

Material: diagnostic speaking cards, teacher observation checklist, and a short classroom language mini-bank.

Learning flow: learners greet a partner, ask for help, respond to classroom instructions, and repair communication with simple phrases such as asking someone to repeat or explain.

Interactive content: random prompt cards pair a situation with a response target. The learner records or performs a 30-45 second exchange, then receives checklist feedback on clarity, politeness, and confidence.

Evidence: completed speaking card, self-rating, and one improvement target for the next module.`,
    },
    {
      id: englishGrade7ModuleIds[1],
      title: "Classroom language, routines, and learning habits",
      summary: "Learners understand classroom instructions and describe simple learning routines using everyday English.",
      type: "reading" as const,
      estimatedMinutes: 40,
      content: `Learning focus: listening for instructions and reading classroom routines.

Material: listening sprint blueprint, classroom command bank, routine planner, and short teacher-modeled dialogues.

Learning flow: learners match instructions to actions, identify useful phrases, then write a short routine for preparing English class.

Interactive content: listen-and-match activity with immediate feedback. Distractors are designed around common Grade 7 misunderstandings such as confusing open, close, listen, repeat, write, and discuss.

Evidence: routine planner plus three classroom phrases the learner can use independently.`,
    },
    {
      id: englishGrade7ModuleIds[2],
      title: "Introducing myself and my classmates",
      summary: "Learners create a short personal profile, interview a partner, and introduce someone else accurately.",
      type: "interactive" as const,
      estimatedMinutes: 45,
      content: `Learning focus: self introduction, questions, answers, and short written profiles.

Material: personal profile builder, pair interview sheet, pronunciation notes for names and interests, and revision checklist.

Learning flow: learners draft a profile, interview a partner using guided questions, then revise the profile into a short introduction paragraph.

Interactive content: profile builder checks required fields, flags missing capitalization, and asks learners to choose the correct be verb or possessive adjective before submitting.

Evidence: one self profile, one classmate profile, and a 45-60 second spoken introduction.`,
    },
    {
      id: englishGrade7ModuleIds[3],
      title: "Describing people, school places, and familiar objects",
      summary: "Learners read and write descriptive texts using nouns, adjectives, there is, and there are.",
      type: "reading" as const,
      estimatedMinutes: 45,
      content: `Learning focus: descriptive text purpose, details, and simple sentence control.

Material: original descriptive reading pack, adjective sorting cards, place vocabulary map, and paragraph frame.

Learning flow: learners identify the topic and supporting details in short texts, sort adjectives by meaning, then compose a description of a familiar person, classroom, library, or school object.

Interactive content: detail-highlighter activity asks learners to mark topic, appearance, location, and function. Feedback explains why each detail supports the description.

Evidence: one revised descriptive paragraph with peer feedback.`,
    },
    {
      id: englishGrade7ModuleIds[4],
      title: "Daily routines, preferences, and simple exchanges",
      summary: "Learners ask and answer about routines, schedules, likes, dislikes, and study habits.",
      type: "assignment" as const,
      estimatedMinutes: 40,
      content: `Learning focus: simple present patterns for routines and preferences.

Material: weekly routine grid, preference survey, short dialogue model, and sentence transformation practice.

Learning flow: learners fill a routine grid, ask classmates about habits, compare answers, and write a short reflection on learning habits.

Interactive content: survey builder turns learner answers into sentence prompts, then checks subject-verb agreement and frequency adverbs.

Evidence: completed survey, two dialogue turns, and a routine paragraph.`,
    },
    {
      id: englishGrade7ModuleIds[5],
      title: "Instructions, short messages, and final mini project",
      summary: "Learners sequence procedures, interpret short messages, and present a simple multimodal project.",
      type: "interactive" as const,
      estimatedMinutes: 55,
      content: `Learning focus: procedure texts, short functional messages, and audience-aware presentation.

Material: procedure sequencer, short message cards, project planning canvas, and Grade 7 presentation rubric.

Learning flow: learners arrange steps in a familiar procedure, identify key information in short messages, then create a short multimodal presentation about a school routine, favorite place, or useful learning habit.

Interactive content: drag-and-order procedure task, connector gap-fill, and peer rubric workflow for giving kind, specific feedback.

Evidence: final project presentation, peer feedback, and reflection on one speaking and one writing improvement.`,
    },
  ];

  await db.insert(courses).values({
    id: englishGrade7CourseId,
    organizationId: null,
    ownerId: contentManagerUserId,
    title: "Kurikulum Merdeka English Grade 7: Pathway Foundations",
    slug: "kurikulum-merdeka-english-grade-7-pathway-foundations",
    description: "Global Grade 7 English course for Kurikulum Merdeka, adapted from the local Pathway to English 1 teacher-guide reference into classroom interaction, profile, descriptive, routine, procedure, and presentation modules.",
    category: "English",
    contentTrack: "SCH",
    curriculumCode: "MER",
    schoolLevel: "SMP",
    gradeLabel: "Kelas 7",
    subjectCode: "ENG",
    skillFramework: null,
    level: "beginner",
    status: "published",
    aiGenerated: false,
    priceCents: 0,
    estimatedMinutes: englishGrade7Modules.reduce((sum, module) => sum + module.estimatedMinutes, 0),
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: courses.id,
    set: {
      organizationId: null,
      ownerId: contentManagerUserId,
      title: "Kurikulum Merdeka English Grade 7: Pathway Foundations",
      slug: "kurikulum-merdeka-english-grade-7-pathway-foundations",
      description: "Global Grade 7 English course for Kurikulum Merdeka, adapted from the local Pathway to English 1 teacher-guide reference into classroom interaction, profile, descriptive, routine, procedure, and presentation modules.",
      category: "English",
      contentTrack: "SCH",
      curriculumCode: "MER",
      schoolLevel: "SMP",
      gradeLabel: "Kelas 7",
      subjectCode: "ENG",
      skillFramework: null,
      level: "beginner",
      status: "published",
      aiGenerated: false,
      priceCents: 0,
      estimatedMinutes: englishGrade7Modules.reduce((sum, module) => sum + module.estimatedMinutes, 0),
      updatedAt: now,
    },
  });

  for (const [index, module] of englishGrade7Modules.entries()) {
    await db.insert(courseModules).values({
      id: module.id,
      courseId: englishGrade7CourseId,
      title: module.title,
      summary: module.summary,
      position: index + 1,
      type: module.type,
      content: module.content,
      estimatedMinutes: module.estimatedMinutes,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: courseModules.id,
      set: {
        title: module.title,
        summary: module.summary,
        position: index + 1,
        type: module.type,
        content: module.content,
        estimatedMinutes: module.estimatedMinutes,
        updatedAt: now,
      },
    });
  }

  await db.insert(assessments).values({
    id: englishGrade7AssessmentId,
    courseId: englishGrade7CourseId,
    moduleId: englishGrade7ModuleIds[5],
    title: "Grade 7 English pathway performance checkpoint",
    type: "project",
    prompt: "Create and present a simple multimodal project about a familiar school routine, person, place, or learning habit. Include a short written text, clear spoken delivery, and one response to peer feedback.",
    rubric: ["Message clarity", "Language control", "Speaking confidence", "Use of visuals", "Response to feedback"],
    maxScore: 100,
    passingScore: 70,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: assessments.id,
    set: {
      moduleId: englishGrade7ModuleIds[5],
      title: "Grade 7 English pathway performance checkpoint",
      type: "project",
      prompt: "Create and present a simple multimodal project about a familiar school routine, person, place, or learning habit. Include a short written text, clear spoken delivery, and one response to peer feedback.",
      rubric: ["Message clarity", "Language control", "Speaking confidence", "Use of visuals", "Response to feedback"],
      maxScore: 100,
      passingScore: 70,
      updatedAt: now,
    },
  });

  for (const objectiveId of englishGrade7ObjectiveIds) {
    await db.insert(courseLearningObjectives).values({
      courseId: englishGrade7CourseId,
      learningObjectiveId: objectiveId,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  await db.insert(notifications).values({
    id: "70707070-6666-4666-8666-707070707001",
    userId: contentManagerUserId,
    type: "course",
    title: "Grade 7 English Merdeka content published",
    body: "The global Kurikulum Merdeka English Grade 7 pathway is available in Content Library and learner Course Catalog.",
    actionUrl: "/content/library",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  const englishSchoolUsers = [
    {
      userId: englishSchoolOwnerUserId,
      accountId: englishSchoolOwnerAccountId,
      name: "Pak Dimas - SMP Tenant Owner",
      email: "owner.smp-global@oetakstudio.local",
      headline: "School tenant owner using global Merdeka English content",
      goals: ["Review global content usage", "Monitor Grade 7 English adoption"],
      interests: ["School operations", "Curriculum adoption"],
      accountType: "organization" as const,
    },
    {
      userId: englishSchoolAdminUserId,
      accountId: englishSchoolAdminAccountId,
      name: "Bu Laila - SMP Admin",
      email: "admin.smp-global@oetakstudio.local",
      headline: "School admin for SMP Global Merdeka Demo",
      goals: ["Manage learner access", "Track English Grade 7 progress"],
      interests: ["Student analytics", "School support"],
      accountType: "organization" as const,
    },
    {
      userId: englishSchoolTeacherUserId,
      accountId: englishSchoolTeacherAccountId,
      name: "Ms. Hana - English Teacher",
      email: "teacher.hana@oetakstudio.local",
      headline: "Grade 7 English teacher assigning global platform content",
      goals: ["Guide classroom English practice", "Review learner evidence"],
      interests: ["English speaking", "Merdeka curriculum", "Project assessment"],
      accountType: "organization" as const,
    },
    {
      userId: englishSchoolStudentUserId,
      accountId: englishSchoolStudentAccountId,
      name: "Nadia Putri - Grade 7 Learner",
      email: "nadia.grade7@oetakstudio.local",
      headline: "Grade 7 learner enrolled through SMP Global Merdeka Demo",
      goals: ["Build classroom English confidence", "Complete Grade 7 English pathway"],
      interests: ["English", "School projects", "Speaking practice"],
      accountType: "organization" as const,
    },
  ];

  for (const englishSchoolUser of englishSchoolUsers) {
    await upsertCredentialUser({
      userId: englishSchoolUser.userId,
      accountId: englishSchoolUser.accountId,
      name: englishSchoolUser.name,
      email: englishSchoolUser.email,
      password: englishSchoolPassword,
    });

    await db.insert(learnerProfiles).values({
      userId: englishSchoolUser.userId,
      accountType: englishSchoolUser.accountType,
      headline: englishSchoolUser.headline,
      goals: englishSchoolUser.goals,
      interests: englishSchoolUser.interests,
      proficiencyLevel: englishSchoolUser.userId === englishSchoolStudentUserId ? "beginner" : "advanced",
      targetStudyMinutes: englishSchoolUser.userId === englishSchoolStudentUserId ? 150 : 120,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: learnerProfiles.userId,
      set: {
        accountType: englishSchoolUser.accountType,
        headline: englishSchoolUser.headline,
        goals: englishSchoolUser.goals,
        interests: englishSchoolUser.interests,
        proficiencyLevel: englishSchoolUser.userId === englishSchoolStudentUserId ? "beginner" : "advanced",
        targetStudyMinutes: englishSchoolUser.userId === englishSchoolStudentUserId ? 150 : 120,
        updatedAt: now,
      },
    });
  }

  await seedOrganizationWorkspace({
    workspaceId: englishSchoolOrgWorkspaceId,
    name: "SMP Global Merdeka Demo",
    organizationSlug: "smp-global-merdeka-demo",
    ownerUserId: englishSchoolOwnerUserId,
  });

  await db.insert(organizations).values({
    id: englishSchoolOrgId,
    workspaceId: englishSchoolOrgWorkspaceId,
    name: "SMP Global Merdeka Demo",
    slug: "smp-global-merdeka-demo",
    description: "School tenant that adopts global Kurikulum Merdeka English Grade 7 content from the platform catalog.",
    domain: "smp-global-merdeka-demo.local",
    plan: "personal",
    type: "school",
    primaryContentTrack: "SCH",
    curriculumMode: "inherited",
    brandColor: "#274029",
    ownerId: englishSchoolOwnerUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: organizations.id,
    set: {
      name: "SMP Global Merdeka Demo",
      slug: "smp-global-merdeka-demo",
      description: "School tenant that adopts global Kurikulum Merdeka English Grade 7 content from the platform catalog.",
      domain: "smp-global-merdeka-demo.local",
      plan: "personal",
      type: "school",
      primaryContentTrack: "SCH",
      curriculumMode: "inherited",
      brandColor: "#274029",
      ownerId: englishSchoolOwnerUserId,
      updatedAt: now,
    },
  });

  const englishSchoolMembers = [
    { userId: englishSchoolOwnerUserId, role: "owner" as const },
    { userId: englishSchoolAdminUserId, role: "admin" as const },
    { userId: englishSchoolTeacherUserId, role: "teacher" as const },
    { userId: englishSchoolStudentUserId, role: "learner" as const },
  ];

  for (const member of englishSchoolMembers) {
    await db.insert(organizationMembers).values({
      organizationId: englishSchoolOrgId,
      userId: member.userId,
      role: member.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: member.role, status: "active", updatedAt: now },
    });
  }

  await db.insert(subscriptions).values({
    id: "71717171-8888-4888-8888-717171717001",
    subjectType: "organization",
    subjectId: englishSchoolOrgId,
    plan: "personal",
    status: "active",
    seats: 20,
    billingEmail: "billing.smp-global@oetakstudio.local",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    notes: "Demo school tenant adopting global Grade 7 English content.",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: subscriptions.id,
    set: {
      subjectType: "organization",
      subjectId: englishSchoolOrgId,
      plan: "personal",
      status: "active",
      seats: 20,
      billingEmail: "billing.smp-global@oetakstudio.local",
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      notes: "Demo school tenant adopting global Grade 7 English content.",
      updatedAt: now,
    },
  });

  await db.insert(enrollments).values({
    id: englishSchoolEnrollmentId,
    courseId: englishGrade7CourseId,
    userId: englishSchoolStudentUserId,
    organizationId: englishSchoolOrgId,
    status: "active",
    progress: 0,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: enrollments.id,
    set: {
      courseId: englishGrade7CourseId,
      userId: englishSchoolStudentUserId,
      organizationId: englishSchoolOrgId,
      status: "active",
      progress: 0,
      completedAt: null,
      updatedAt: now,
    },
  });

  await db.insert(personalLibraryItems).values({
    id: "71717171-bbbb-4bbb-8bbb-717171717001",
    userId: englishSchoolStudentUserId,
    courseId: englishGrade7CourseId,
    assetId: englishGrade7AssetIds[0],
    notes: "School-assigned starting material for Grade 7 English classroom confidence.",
    tags: ["English", "Kelas 7", "Merdeka", "School assigned"],
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(notifications).values({
    id: "71717171-dddd-4ddd-8ddd-717171717001",
    userId: englishSchoolStudentUserId,
    type: "course",
    title: "Grade 7 English course assigned",
    body: "SMP Global Merdeka Demo has assigned the global Kurikulum Merdeka English Grade 7 pathway to your account.",
    actionUrl: `/dashboard/courses/${englishGrade7CourseId}`,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(contentAssets).values({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    organizationId: null,
    ownerId: contentManagerUserId,
    title: "Trigonometry Interactive Practice Template",
    description: "Reusable H5P-style activity blueprint for curriculum-scoped trigonometry practice.",
    kind: "h5p",
    status: "published",
    sourceUrl: null,
    tags: ["MATH", "MER", "interactive"],
    metadata: { curriculum: "MER", subject: "MATH", grade: "Kelas 11" },
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({ target: contentAssets.id, set: { status: "published", updatedAt: now } });

  await db.insert(notifications).values({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    userId: maintenanceUserId,
    type: "system",
    title: "Platform taxonomy seeded",
    body: "System curricula, content tracks, and learning objectives are ready for content operations.",
    actionUrl: "/admin/settings",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();


  const scenarioUsers = [
    {
      userId: scenarioOwnerUserId,
      accountId: scenarioOwnerAccountId,
      name: "Bapak Arif - Tenant Owner",
      email: "owner.sma-merdeka@oetakstudio.local",
      headline: "School tenant owner for Scenario 1",
      goals: ["Monitor school subscription", "Review Merdeka curriculum delivery"],
      interests: ["School operations", "Curriculum governance"],
      accountType: "organization" as const,
    },
    {
      userId: scenarioAdminUserId,
      accountId: scenarioAdminAccountId,
      name: "Ibu Rani - School Admin",
      email: "admin.sma-merdeka@oetakstudio.local",
      headline: "Organization admin for SMA Merdeka Nusantara",
      goals: ["Manage members", "Track Grade 11 progress"],
      interests: ["Analytics", "Student support"],
      accountType: "organization" as const,
    },
    {
      userId: scenarioTeacherUserId,
      accountId: scenarioTeacherAccountId,
      name: "Ibu Siti - Math Teacher",
      email: "teacher.siti@oetakstudio.local",
      headline: "Mathematics teacher for Grade 11 Science",
      goals: ["Teach trigonometry", "Use AI tutor support"],
      interests: ["Mathematics", "Merdeka curriculum", "Assessment"],
      accountType: "organization" as const,
    },
    {
      userId: scenarioStudentUserId,
      accountId: scenarioStudentAccountId,
      name: "Aisha Rahma",
      email: "aisha.grade11@oetakstudio.local",
      headline: "Grade 11 Science student learning trigonometric functions",
      goals: ["Master trigonometric ratios", "Complete Merdeka Grade 11 Mathematics path"],
      interests: ["Mathematics", "Science", "Problem solving"],
      accountType: "organization" as const,
    },
    {
      userId: scenarioParentUserId,
      accountId: scenarioParentAccountId,
      name: "Ibu Nadia - Parent Observer",
      email: "parent.aisha@oetakstudio.local",
      headline: "Parent observer for Aisha's Scenario 1 progress",
      goals: ["Monitor Aisha's learning progress", "Receive school updates"],
      interests: ["Parent communication", "Student progress"],
      accountType: "individual" as const,
    },
  ];

  for (const scenarioUser of scenarioUsers) {
    await upsertCredentialUser({
      userId: scenarioUser.userId,
      accountId: scenarioUser.accountId,
      name: scenarioUser.name,
      email: scenarioUser.email,
      password: scenarioPassword,
    });

    await db.insert(learnerProfiles).values({
      userId: scenarioUser.userId,
      accountType: scenarioUser.accountType,
      headline: scenarioUser.headline,
      goals: scenarioUser.goals,
      interests: scenarioUser.interests,
      proficiencyLevel: scenarioUser.userId === scenarioStudentUserId ? "intermediate" : "advanced",
      targetStudyMinutes: scenarioUser.userId === scenarioStudentUserId ? 180 : 120,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: learnerProfiles.userId,
      set: {
        accountType: scenarioUser.accountType,
        headline: scenarioUser.headline,
        goals: scenarioUser.goals,
        interests: scenarioUser.interests,
        proficiencyLevel: scenarioUser.userId === scenarioStudentUserId ? "intermediate" : "advanced",
        targetStudyMinutes: scenarioUser.userId === scenarioStudentUserId ? 180 : 120,
        updatedAt: now,
      },
    });
  }

  await seedOrganizationWorkspace({
    workspaceId: scenarioOrgWorkspaceId,
    name: "SMA Merdeka Nusantara Demo",
    organizationSlug: "sma-merdeka-nusantara-demo",
    ownerUserId: scenarioOwnerUserId,
  });

  await db.insert(organizations).values({
    id: scenarioOrgId,
    workspaceId: scenarioOrgWorkspaceId,
    name: "SMA Merdeka Nusantara Demo",
    slug: "sma-merdeka-nusantara-demo",
    description: "Scenario 1 school tenant using inherited Kurikulum Merdeka for Grade 11 Mathematics.",
    domain: "sma-merdeka-demo.local",
    plan: "team",
    type: "school",
    primaryContentTrack: "SCH",
    curriculumMode: "inherited",
    brandColor: "#274029",
    ownerId: scenarioOwnerUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: organizations.id,
    set: {
      name: "SMA Merdeka Nusantara Demo",
      description: "Scenario 1 school tenant using inherited Kurikulum Merdeka for Grade 11 Mathematics.",
      domain: "sma-merdeka-demo.local",
      plan: "team",
      type: "school",
      primaryContentTrack: "SCH",
      curriculumMode: "inherited",
      brandColor: "#274029",
      ownerId: scenarioOwnerUserId,
      updatedAt: now,
    },
  });

  const scenarioMembers = [
    { userId: scenarioOwnerUserId, role: "owner" as const },
    { userId: scenarioAdminUserId, role: "admin" as const },
    { userId: scenarioTeacherUserId, role: "teacher" as const },
    { userId: scenarioStudentUserId, role: "learner" as const },
    { userId: scenarioParentUserId, role: "guardian" as const },
  ];

  for (const member of scenarioMembers) {
    await db.insert(organizationMembers).values({
      organizationId: scenarioOrgId,
      userId: member.userId,
      role: member.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: member.role, status: "active", updatedAt: now },
    });
  }

  await db.insert(subscriptions).values({
    id: "10101010-8888-4888-8888-101010101001",
    subjectType: "organization",
    subjectId: scenarioOrgId,
    plan: "team",
    status: "active",
    seats: 30,
    billingEmail: "billing.sma-merdeka@oetakstudio.local",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    notes: "Scenario 1 school subscription for Grade 11 Mathematics demo.",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: subscriptions.id,
    set: {
      subjectType: "organization",
      subjectId: scenarioOrgId,
      plan: "team",
      status: "active",
      seats: 30,
      billingEmail: "billing.sma-merdeka@oetakstudio.local",
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      notes: "Scenario 1 school subscription for Grade 11 Mathematics demo.",
      updatedAt: now,
    },
  });

  const scenarioModules = [
    {
      id: scenarioModuleIds[0],
      title: "Trigonometric ratios baseline",
      summary: "Connect sine, cosine, and tangent to right-triangle relationships for Merdeka Grade 11.",
      type: "interactive" as const,
      content: "Aisha starts by comparing similar right triangles, then identifies opposite, adjacent, and hypotenuse sides before choosing sine, cosine, or tangent.",
      estimatedMinutes: 30,
    },
    {
      id: scenarioModuleIds[1],
      title: "Trigonometric identities booster",
      summary: "Use core identities to simplify expressions and solve structured problems.",
      type: "reading" as const,
      content: "Review sin²x + cos²x = 1 and use it to transform expressions. Keep each algebraic step visible and tied to the identity used.",
      estimatedMinutes: 35,
    },
    {
      id: scenarioModuleIds[2],
      title: "Applications and reflection",
      summary: "Apply trigonometry to height, distance, and angle problems with a written explanation.",
      type: "assignment" as const,
      content: "Solve two contextual problems. Draw the triangle, label known values, select the ratio or identity, solve, and write a short reflection.",
      estimatedMinutes: 30,
    },
  ];

  await db.insert(courses).values({
    id: scenarioCourseId,
    organizationId: scenarioOrgId,
    ownerId: scenarioTeacherUserId,
    title: "Scenario 1: Merdeka Grade 11 Trigonometric Functions",
    slug: "scenario-1-merdeka-grade-11-trigonometry",
    description: "Scenario 1 course for Aisha, a Grade 11 Science student, covering trigonometric functions with scoped Merdeka learning objectives.",
    category: "Mathematics",
    contentTrack: "SCH",
    curriculumCode: "MER",
    schoolLevel: "SMA",
    gradeLabel: "Kelas 11",
    subjectCode: "MATH",
    skillFramework: null,
    level: "intermediate",
    status: "published",
    aiGenerated: true,
    priceCents: 0,
    estimatedMinutes: scenarioModules.reduce((sum, module) => sum + module.estimatedMinutes, 0),
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: courses.id,
    set: {
      organizationId: scenarioOrgId,
      ownerId: scenarioTeacherUserId,
      title: "Scenario 1: Merdeka Grade 11 Trigonometric Functions",
      description: "Scenario 1 course for Aisha, a Grade 11 Science student, covering trigonometric functions with scoped Merdeka learning objectives.",
      contentTrack: "SCH",
      curriculumCode: "MER",
      schoolLevel: "SMA",
      gradeLabel: "Kelas 11",
      subjectCode: "MATH",
      level: "intermediate",
      status: "published",
      updatedAt: now,
    },
  });

  for (const [index, module] of scenarioModules.entries()) {
    await db.insert(courseModules).values({
      id: module.id,
      courseId: scenarioCourseId,
      title: module.title,
      summary: module.summary,
      position: index + 1,
      type: module.type,
      content: module.content,
      estimatedMinutes: module.estimatedMinutes,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: courseModules.id,
      set: {
        title: module.title,
        summary: module.summary,
        position: index + 1,
        type: module.type,
        content: module.content,
        estimatedMinutes: module.estimatedMinutes,
        updatedAt: now,
      },
    });
  }

  await db.insert(assessments).values({
    id: scenarioAssessmentId,
    courseId: scenarioCourseId,
    moduleId: scenarioModuleIds[2],
    title: "Scenario 1 trigonometry checkpoint",
    type: "essay",
    prompt: "Explain how Aisha should choose between sine, cosine, tangent, and trigonometric identities in a Grade 11 contextual problem.",
    rubric: ["Ratio selection", "Identity usage", "Contextual reasoning", "Clear explanation"],
    maxScore: 100,
    passingScore: 70,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: assessments.id,
    set: { prompt: "Explain how Aisha should choose between sine, cosine, tangent, and trigonometric identities in a Grade 11 contextual problem.", updatedAt: now },
  });

  await db.insert(enrollments).values({
    id: scenarioEnrollmentId,
    courseId: scenarioCourseId,
    userId: scenarioStudentUserId,
    organizationId: scenarioOrgId,
    status: "active",
    progress: 33,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: enrollments.id,
    set: { status: "active", progress: 33, updatedAt: now },
  });

  const progressRows = [
    { id: "10101010-9999-4999-8999-101010101001", moduleId: scenarioModuleIds[0], status: "completed" as const, score: 84, timeSpentMinutes: 32, completedAt: now },
    { id: "10101010-9999-4999-8999-101010101002", moduleId: scenarioModuleIds[1], status: "in_progress" as const, score: 62, timeSpentMinutes: 18, completedAt: null },
    { id: "10101010-9999-4999-8999-101010101003", moduleId: scenarioModuleIds[2], status: "not_started" as const, score: null, timeSpentMinutes: 0, completedAt: null },
  ];

  for (const progress of progressRows) {
    await db.insert(moduleProgress).values({
      id: progress.id,
      enrollmentId: scenarioEnrollmentId,
      moduleId: progress.moduleId,
      userId: scenarioStudentUserId,
      status: progress.status,
      score: progress.score,
      timeSpentMinutes: progress.timeSpentMinutes,
      completedAt: progress.completedAt,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: moduleProgress.id,
      set: {
        status: progress.status,
        score: progress.score,
        timeSpentMinutes: progress.timeSpentMinutes,
        completedAt: progress.completedAt,
        updatedAt: now,
      },
    });
  }

  await db.insert(placementTests).values({
    id: scenarioPlacementId,
    userId: scenarioStudentUserId,
    organizationId: scenarioOrgId,
    courseId: scenarioCourseId,
    track: "SCH",
    curriculumCode: "MER",
    levelCode: "SMA",
    gradeLabel: "Kelas 11",
    subjectCode: "MATH",
    skillFramework: null,
    scope: "strict_lo_scope",
    status: "scored",
    score: 72,
    recommendedLevel: "intermediate",
    report: {
      scenario: "Scenario 1",
      rule: "Questions scoped to Merdeka Grade 11 Mathematics LOs and prerequisites",
      recommendation: "Basics -> Identities -> Applications",
    },
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: placementTests.id,
    set: { status: "scored", score: 72, recommendedLevel: "intermediate", updatedAt: now },
  });

  const placementResponseRows = [
    {
      id: "10101010-aaaa-4aaa-8aaa-101010101001",
      learningObjectiveId: "88888888-8888-4888-8888-888888888804",
      question: "Determine trigonometric ratios in a right triangle.",
      answer: "Aisha identifies opposite, adjacent, and hypotenuse, then selects sine, cosine, or tangent based on the known sides.",
      isCorrect: true,
      score: 78,
      feedback: "Ratio selection is clear. Add one labeled diagram for stronger mastery.",
    },
    {
      id: "10101010-aaaa-4aaa-8aaa-101010101002",
      learningObjectiveId: "88888888-8888-4888-8888-888888888805",
      question: "Use identities to solve a trigonometric expression.",
      answer: "Aisha uses sin²x + cos²x = 1 but needs more practice explaining transformation steps.",
      isCorrect: true,
      score: 66,
      feedback: "Core identity is recognized; remediation focuses on algebraic explanation.",
    },
  ];

  for (const response of placementResponseRows) {
    await db.insert(placementResponses).values({
      ...response,
      placementTestId: scenarioPlacementId,
      createdAt: now,
    }).onConflictDoNothing();
  }

  await db.insert(personalLibraryItems).values({
    id: "10101010-bbbb-4bbb-8bbb-101010101001",
    userId: scenarioStudentUserId,
    courseId: scenarioCourseId,
    assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    notes: "Saved by Aisha for extra trigonometry identity practice.",
    tags: ["Scenario 1", "Trigonometry", "Merdeka"],
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(discussionThreads).values({
    id: scenarioDiscussionId,
    organizationId: scenarioOrgId,
    courseId: scenarioCourseId,
    createdById: scenarioTeacherUserId,
    title: "Scenario 1: Aisha trigonometry support",
    visibility: "course",
    status: "open",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: discussionThreads.id,
    set: { title: "Scenario 1: Aisha trigonometry support", status: "open", updatedAt: now },
  });

  await db.insert(discussionPosts).values({
    id: "10101010-cccc-4ccc-8ccc-101010101001",
    threadId: scenarioDiscussionId,
    authorId: scenarioTeacherUserId,
    content: "Aisha has completed the ratio baseline and should focus next on explaining identity transformations step by step.",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  const scenarioNotifications = [
    { id: "10101010-dddd-4ddd-8ddd-101010101001", userId: scenarioStudentUserId, type: "assessment" as const, title: "Scenario 1 placement scored", body: "Your Merdeka Grade 11 Mathematics placement score is 72%. Continue with identities booster.", actionUrl: "/dashboard/placement" },
    { id: "10101010-dddd-4ddd-8ddd-101010101002", userId: scenarioTeacherUserId, type: "course" as const, title: "Aisha needs identity support", body: "Scenario 1 progress shows Aisha is ready for guided practice on trigonometric identities.", actionUrl: "/dashboard/discussions" },
    { id: "10101010-dddd-4ddd-8ddd-101010101003", userId: scenarioParentUserId, type: "system" as const, title: "Aisha progress demo ready", body: "Parent observer demo account can review notification and discussion flows for Scenario 1.", actionUrl: "/dashboard/notifications" },
  ];

  for (const notification of scenarioNotifications) {
    await db.insert(notifications).values({ ...notification, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }

  for (const course of demoCourses) {
    await db.insert(courses).values({
      id: course.id,
      organizationId: null,
      ownerId: demoUserId,
      title: course.title,
      slug: course.slug,
      description: course.description,
      category: course.category,
      contentTrack: course.category === "Mathematics" ? "SCH" : "LNG",
      curriculumCode: course.category === "Mathematics" ? "MER" : null,
      schoolLevel: course.category === "Mathematics" ? "SMA" : null,
      gradeLabel: course.category === "Mathematics" ? "Kelas 11" : null,
      subjectCode: course.category === "Mathematics" ? "MATH" : "ENG",
      skillFramework: course.category === "Mathematics" ? null : "IELTS",
      level: course.level,
      status: "published",
      aiGenerated: true,
      priceCents: 0,
      estimatedMinutes: course.estimatedMinutes,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    for (const [index, module] of course.modules.entries()) {
      await db.insert(courseModules).values({
        id: module.id,
        courseId: course.id,
        title: module.title,
        summary: module.summary,
        position: index + 1,
        type: module.type,
        content: module.content,
        estimatedMinutes: module.estimatedMinutes,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }

    await db.insert(assessments).values({
      id: `55555555-5555-4555-8555-${course.id.slice(-12)}`,
      courseId: course.id,
      moduleId: course.modules.at(-1)?.id,
      title: `${course.title} checkpoint`,
      type: "essay",
      prompt: "Summarize the most important concept and explain how you would apply it in a real learning task.",
      rubric: ["Accuracy", "Application", "Clarity"],
      maxScore: 100,
      passingScore: 70,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  console.log(`Seed data inserted. Maintenance owner: ${maintenanceEmail}. Content manager: ${contentManagerEmail}. Scenario 1 password: ${scenarioPassword}. English school password: ${englishSchoolPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
