import { z } from "zod";
import {
  CONTENT_TRACKS,
  COURSE_LEVELS,
  COURSE_STATUSES,
  ORGANIZATION_ROLES,
  ORGANIZATION_TYPES,
  QUESTION_TYPES,
  SUBSCRIPTION_PLANS,
} from "@/types/domain";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(12),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  level: z.enum(COURSE_LEVELS).optional(),
  sort: z.enum(["newest", "oldest", "title"]).default("newest"),
});

export const onboardingSchema = z.object({
  accountType: z.enum(["individual", "organization"]),
  headline: z.string().trim().max(160).optional(),
  goals: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  interests: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  proficiencyLevel: z.string().trim().min(2).max(40).default("beginner"),
  targetStudyMinutes: z.number().int().min(15).max(1200).default(120),
  organization: z
    .object({
      name: z.string().trim().min(2).max(120),
      slug: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes"),
      description: z.string().trim().max(500).optional(),
      domain: z.string().trim().max(120).optional(),
      type: z.enum(ORGANIZATION_TYPES).default("institution"),
      primaryContentTrack: z.enum(CONTENT_TRACKS).default("PRO"),
      curriculumMode: z.enum(["inherited", "custom"]).default("inherited"),
    })
    .optional(),
});

const moduleInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(10).max(500),
  type: z.enum(["video", "reading", "interactive", "quiz", "assignment"]),
  content: z.string().trim().min(20).max(8000),
  estimatedMinutes: z.number().int().min(5).max(600).default(20),
});

const courseAssessmentQuestionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().min(2).max(4000),
  options: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(1000),
  })).max(20).optional(),
  correctOptionIds: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  points: z.number().int().positive().max(10_000),
  feedback: z.string().trim().max(4000).optional(),
}).superRefine((question, context) => {
  if (["multiple_choice", "true_false"].includes(question.type)) {
    if (!question.options || question.options.length < 2) {
      context.addIssue({ code: "custom", message: "Objective questions require at least two options", path: ["options"] });
    }
    if (!question.correctOptionIds?.length) {
      context.addIssue({ code: "custom", message: "Objective questions require a correct option", path: ["correctOptionIds"] });
    }
  }
  if (question.type === "fill_blank" && !question.acceptedAnswers?.length) {
    context.addIssue({ code: "custom", message: "Fill-in questions require an accepted answer", path: ["acceptedAnswers"] });
  }
});

const courseAssessmentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  purpose: z.enum(["diagnostic", "formative", "summative"]).default("formative"),
  passingScore: z.number().int().min(0).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(20).default(3),
  questions: z.array(courseAssessmentQuestionSchema).min(1).max(100),
});

export const courseCreateSchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes"),
  description: z.string().trim().min(20).max(1200),
  category: z.string().trim().min(2).max(80),
  contentTrack: z.enum(CONTENT_TRACKS).default("GEN"),
  curriculumCode: z.string().trim().max(30).optional().nullable(),
  schoolLevel: z.string().trim().max(40).optional().nullable(),
  gradeLabel: z.string().trim().max(80).optional().nullable(),
  subjectCode: z.string().trim().max(30).optional().nullable(),
  skillFramework: z.string().trim().max(80).optional().nullable(),
  level: z.enum(COURSE_LEVELS),
  status: z.enum(COURSE_STATUSES).default("draft"),
  aiGenerated: z.boolean().default(false),
  priceCents: z.number().int().min(0).max(100_000_000).default(0),
  estimatedMinutes: z.number().int().min(15).max(20_000).default(60),
  modules: z.array(moduleInputSchema).min(1).max(20),
  assessment: courseAssessmentSchema,
});

export const aiCourseGenerationSchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(160),
  sourceText: z.string().trim().min(50).max(40_000),
  contentTrack: z.enum(CONTENT_TRACKS),
  level: z.enum(COURSE_LEVELS),
  category: z.string().trim().min(2).max(80),
  language: z.string().trim().min(2).max(40).default("English"),
  moduleCount: z.number().int().min(1).max(8).default(4),
  curriculumCode: z.string().trim().max(30).optional().nullable(),
  gradeLabel: z.string().trim().max(80).optional().nullable(),
  subjectCode: z.string().trim().max(30).optional().nullable(),
  skillFramework: z.string().trim().max(80).optional().nullable(),
});

export const aiGeneratedCourseSchema = courseCreateSchema
  .omit({ organizationId: true, status: true, aiGenerated: true, priceCents: true })
  .extend({
    slug: z.string().trim().min(3).max(120),
    modules: z.array(moduleInputSchema).min(1).max(8),
  });

export const courseUpdateSchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(160).optional(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes")
    .optional(),
  description: z.string().trim().min(20).max(1200).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  contentTrack: z.enum(CONTENT_TRACKS).optional(),
  curriculumCode: z.string().trim().max(30).optional().nullable(),
  schoolLevel: z.string().trim().max(40).optional().nullable(),
  gradeLabel: z.string().trim().max(80).optional().nullable(),
  subjectCode: z.string().trim().max(30).optional().nullable(),
  skillFramework: z.string().trim().max(80).optional().nullable(),
  level: z.enum(COURSE_LEVELS).optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  aiGenerated: z.boolean().optional(),
  priceCents: z.number().int().min(0).max(100_000_000).optional(),
  estimatedMinutes: z.number().int().min(15).max(20_000).optional(),
  modules: z.array(moduleInputSchema).min(1).max(20).optional(),
});

export const progressUpdateSchema = z.object({
  enrollmentId: z.string().uuid(),
  status: z.enum(["in_progress", "completed"]),
  score: z.number().int().min(0).max(100).optional(),
  timeSpentMinutes: z.number().int().min(0).max(2000).default(0),
});

const assessmentAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(120),
  selectedOptionIds: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  text: z.string().trim().max(10_000).optional(),
}).refine((value) => Boolean(value.text || value.selectedOptionIds?.length), {
  message: "An answer value is required",
});

export const assessmentSubmissionSchema = z.object({
  enrollmentId: z.string().uuid(),
  answer: z.string().trim().min(2).max(10_000).optional(),
  answers: z.array(assessmentAnswerSchema).min(1).max(100).optional(),
}).refine((value) => Boolean(value.answer || value.answers?.length), {
  message: "At least one answer is required",
});

export const aiTutorSchema = z.object({
  courseId: z.string().uuid().optional(),
  moduleId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(2).max(2000),
});

export const tutorConversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["active", "closed"]).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes"),
  description: z.string().trim().max(500).optional(),
  domain: z.string().trim().max(120).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  type: z.enum(ORGANIZATION_TYPES).default("institution"),
  primaryContentTrack: z.enum(CONTENT_TRACKS).default("PRO"),
  curriculumMode: z.enum(["inherited", "custom"]).default("inherited"),
});

export const subscriptionUpdateSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
  status: z.enum(["trialing", "active", "past_due", "paused", "canceled"]),
  seats: z.number().int().min(1).max(100_000).default(1),
  billingEmail: z.string().trim().email().optional().or(z.literal("")),
  currentPeriodEnd: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const billingSubscribeSchema = z.object({
  subjectType: z.enum(["individual", "organization"]),
  subjectId: z.string().uuid(),
  plan: z.enum(SUBSCRIPTION_PLANS).exclude(["free"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});


export const contentTrackSchema = z.enum(CONTENT_TRACKS);
export const organizationTypeSchema = z.enum(ORGANIZATION_TYPES);

export const organizationInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ORGANIZATION_ROLES).exclude(["owner"]).default("learner"),
});

export const organizationAcceptInviteSchema = z.object({
  token: z.string().trim().min(32).max(256),
});

export const organizationMemberRoleSchema = z.object({
  role: z.enum(ORGANIZATION_ROLES).exclude(["owner"]),
});

export const taxonomyQuerySchema = z.object({
  track: contentTrackSchema.optional(),
  curriculumCode: z.string().trim().max(40).optional(),
  subjectCode: z.string().trim().max(40).optional(),
  levelCode: z.string().trim().max(40).optional(),
  gradeLabel: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
});

export const curriculumCreateSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  track: contentTrackSchema.default("SCH"),
  organizationId: z.string().uuid().optional().nullable(),
  source: z.enum(["system", "organization"]).default("system"),
  regions: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  characteristics: z.string().trim().min(8).max(600),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const learningObjectiveCreateSchema = z.object({
  objectiveId: z.string().trim().min(4).max(80),
  organizationId: z.string().uuid().optional().nullable(),
  track: contentTrackSchema.default("SCH"),
  curriculumCode: z.string().trim().min(2).max(30),
  levelCode: z.string().trim().min(2).max(40),
  gradeLabel: z.string().trim().min(1).max(80),
  subjectCode: z.string().trim().min(2).max(30),
  topic: z.string().trim().min(2).max(120),
  objective: z.string().trim().min(10).max(800),
  bloomTaxonomy: z.string().trim().min(2).max(80),
  assessmentTypes: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  keywords: z.array(z.string().trim().min(1).max(40)).max(16).default([]),
  prerequisites: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
});

export const placementStartSchema = z.object({
  courseId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional().nullable(),
  track: contentTrackSchema,
  curriculumCode: z.string().trim().max(30).optional(),
  levelCode: z.string().trim().max(40).optional(),
  gradeLabel: z.string().trim().max(80).optional(),
  subjectCode: z.string().trim().max(30).optional(),
  skillFramework: z.string().trim().max(80).optional(),
});

export const placementSubmitSchema = z.object({
  answers: z.array(z.object({
    question: z.string().trim().min(4).max(1000),
    answer: z.string().trim().min(1).max(5000),
    learningObjectiveId: z.string().uuid().optional().nullable(),
  })).min(1).max(20),
});

export const contentAssetCreateSchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(1000),
  kind: z.enum(["video", "audio", "document", "image", "interactive", "scorm", "h5p", "template"]),
  status: z.enum(["draft", "review", "approved", "published", "archived"]).default("draft"),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(16).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const personalLibraryCreateSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(16).default([]),
}).refine((value) => value.courseId || value.assetId, {
  message: "Either courseId or assetId is required",
});

export const discussionCreateSchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(4).max(180),
  visibility: z.enum(["course", "organization", "private"]).default("course"),
  content: z.string().trim().min(2).max(5000),
});

export const discussionPostCreateSchema = z.object({
  content: z.string().trim().min(2).max(5000),
});

export const notificationReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const speechToTextSchema = z.object({
  language: z.string().trim().max(20).optional(),
});

export const textToSpeechSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voiceId: z.string().trim().max(120).optional(),
});

export const assessmentQuestionSchema = courseAssessmentQuestionSchema;
