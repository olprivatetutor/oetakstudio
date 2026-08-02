export const CONTENT_TRACKS = ["SCH", "ESP", "LNP", "LNG", "PRO", "GEN"] as const;
export type ContentTrack = (typeof CONTENT_TRACKS)[number];

export const ORGANIZATION_TYPES = ["school", "corporate", "institution"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_ROLES = [
  "owner",
  "admin",
  "content",
  "teacher",
  "learner",
  "guardian",
] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const SUBSCRIPTION_PLANS = [
  "free",
  "personal",
  "team",
  "professional",
  "enterprise",
  "school",
  "university",
] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_STATUSES = [
  "draft",
  "in_review",
  "needs_revision",
  "published",
  "rejected",
  "archived",
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const ASSESSMENT_PURPOSES = ["diagnostic", "formative", "summative"] as const;
export type AssessmentPurpose = (typeof ASSESSMENT_PURPOSES)[number];

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "fill_blank",
  "matching",
  "essay",
  "speaking",
  "listening",
  "interactive_scenario",
  "project",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type AssessmentQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: Array<{ id: string; label: string }>;
  correctOptionIds?: string[];
  acceptedAnswers?: string[];
  points: number;
  feedback?: string;
};

export type AssessmentAnswer = {
  questionId: string;
  selectedOptionIds?: string[];
  text?: string;
};
