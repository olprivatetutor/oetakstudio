import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  consentRecords,
  guardianLearners,
  organizationMembers,
  organizations,
} from "@/db/schema/learning";

/**
 * AI safety profile resolution (ADR-007, §3.6, §12.11).
 *
 * §12.11 requires every AI call to resolve a safety profile BEFORE execution,
 * and §3.6 rule 2 requires the age band to be resolved before any AI capability
 * call. This module is that resolver; nothing else may decide these questions.
 *
 * The rules below are taken verbatim from §3.6's table and are not extended:
 *
 *   UNDER_13     guardian consent OR institutional consent required before AI
 *                features; no long-term AI memory; strictest content profile.
 *   TEEN_13_17   age-appropriate profile; long-term AI memory opt-in only.
 *   ADULT        standard behaviour.
 *   UNSPECIFIED  treated as TEEN_13_17 until resolved. Fails closed.
 *
 * Note that UNSPECIFIED is NOT denied access: the specification says it is
 * treated as a teen, and teens are permitted. "Fails closed" here means it
 * degrades to the stricter minor profile, not that it blocks. Denying it would
 * be a new product rule and would lock out every existing account, since
 * `age_band` defaults to UNSPECIFIED.
 *
 * §3.6 rule 4 is also load-bearing: where consent is required and absent, AI
 * features are unavailable but core learning, content and assessment remain
 * available. Callers must therefore surface a denial, never fail the lesson.
 */

export type AgeBand = "UNDER_13" | "TEEN_13_17" | "ADULT" | "UNSPECIFIED";
export type EffectiveBand = "UNDER_13" | "TEEN_13_17" | "ADULT";

export type SafetyProfile = {
  /** The stored band, exactly as recorded on the user. */
  ageBand: AgeBand;
  /** The band actually applied, after UNSPECIFIED is resolved to teen. */
  effectiveBand: EffectiveBand;
  isMinor: boolean;
  /** Stable id recorded on ai_usage_records so a past response can be explained. */
  profileId: string;
  tutorAllowed: boolean;
  consentRequired: boolean;
  consentSatisfied: boolean;
  consentBasis: "GUARDIAN" | "INSTITUTIONAL" | null;
  longTermMemoryAllowed: boolean;
  inputModerationRequired: boolean;
  outputModerationRequired: boolean;
  /** Machine-readable reason when tutorAllowed is false. */
  denyReason: "CONSENT_REQUIRED" | null;
};

/** §3.6 rule 1: resolved from birth_date where provided, else the declared band. */
export function resolveAgeBand(input: {
  birthDate: Date | string | null;
  ageBand: AgeBand;
  now?: Date;
}): AgeBand {
  if (!input.birthDate) return input.ageBand;
  const born = input.birthDate instanceof Date ? input.birthDate : new Date(input.birthDate);
  if (Number.isNaN(born.getTime())) return input.ageBand;

  const now = input.now ?? new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;

  if (age < 13) return "UNDER_13";
  if (age < 18) return "TEEN_13_17";
  return "ADULT";
}

export function effectiveBandFor(band: AgeBand): EffectiveBand {
  // §3.6: UNSPECIFIED is treated as TEEN_13_17 until resolved.
  return band === "UNSPECIFIED" ? "TEEN_13_17" : band;
}

/**
 * Is there a live AI_FEATURES consent for this learner?
 *
 * GUARDIAN basis additionally requires an ACTIVE guardian relationship between
 * the grantor and the subject (ADR-007: "verified guardian link"). A PENDING or
 * REVOKED link grants nothing, and a consent row alone is not sufficient.
 *
 * INSTITUTIONAL basis additionally requires the asserting organization to
 * actually be in `consent_mode = INSTITUTIONAL` (§3.6 rule 3) and the learner to
 * be an active member of it.
 */
async function resolveAiConsent(subjectUserId: string) {
  const records = await db
    .select({
      id: consentRecords.id,
      basis: consentRecords.basis,
      grantedById: consentRecords.grantedById,
      workspaceId: consentRecords.workspaceId,
    })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.subjectUserId, subjectUserId),
        eq(consentRecords.consentType, "AI_FEATURES"),
        isNull(consentRecords.revokedAt),
      ),
    );

  if (records.length === 0) return { satisfied: false, basis: null as SafetyProfile["consentBasis"] };

  const guardianGrants = records.filter((record) => record.basis === "GUARDIAN");
  if (guardianGrants.length > 0) {
    const links = await db
      .select({ guardianUserId: guardianLearners.guardianUserId })
      .from(guardianLearners)
      .where(
        and(
          eq(guardianLearners.learnerUserId, subjectUserId),
          eq(guardianLearners.status, "ACTIVE"),
          inArray(
            guardianLearners.guardianUserId,
            guardianGrants.map((grant) => grant.grantedById),
          ),
        ),
      );
    if (links.length > 0) return { satisfied: true, basis: "GUARDIAN" as const };
  }

  const institutionalGrants = records.filter((record) => record.basis === "INSTITUTIONAL");
  if (institutionalGrants.length > 0) {
    const memberships = await db
      .select({ organizationId: organizations.id, workspaceId: organizations.workspaceId })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(organizationMembers.userId, subjectUserId),
          eq(organizationMembers.status, "active"),
          eq(organizations.consentMode, "INSTITUTIONAL"),
        ),
      );
    const eligibleWorkspaces = new Set(memberships.map((row) => row.workspaceId));
    if (institutionalGrants.some((grant) => grant.workspaceId && eligibleWorkspaces.has(grant.workspaceId))) {
      return { satisfied: true, basis: "INSTITUTIONAL" as const };
    }
  }

  // A SELF consent record never satisfies a minor's requirement — that is the
  // whole point of the guardian/institutional condition.
  return { satisfied: false, basis: null as SafetyProfile["consentBasis"] };
}

/**
 * Resolves the safety profile for a user. Call before retrieval, model
 * invocation, history replay, or any persistent memory write.
 */
export async function resolveSafetyProfile(userId: string): Promise<SafetyProfile> {
  const [account] = await db
    .select({ birthDate: user.birthDate, ageBand: user.ageBand })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // An unknown user fails closed to the strictest profile rather than adult.
  const storedBand = (account?.ageBand ?? "UNSPECIFIED") as AgeBand;
  const ageBand = account
    ? resolveAgeBand({ birthDate: account.birthDate, ageBand: storedBand })
    : "UNDER_13";
  const effectiveBand = effectiveBandFor(ageBand);
  const isMinor = effectiveBand !== "ADULT";

  const consentRequired = effectiveBand === "UNDER_13";
  const consent = consentRequired
    ? await resolveAiConsent(userId)
    : { satisfied: false, basis: null as SafetyProfile["consentBasis"] };

  const tutorAllowed = consentRequired ? consent.satisfied : true;

  return {
    ageBand,
    effectiveBand,
    isMinor,
    // Versioned so a stored value keeps its meaning if the rules later change.
    profileId: `${effectiveBand.toLowerCase()}-v1`,
    tutorAllowed,
    consentRequired,
    consentSatisfied: consent.satisfied,
    consentBasis: consent.basis,
    // §3.6: no long-term memory under 13; teen memory is opt-in only, so it is
    // off by default. Opt-in is not yet a product surface, hence false for both.
    longTermMemoryAllowed: effectiveBand === "ADULT",
    // §12.11: moderation runs on BOTH input and output for minor-facing profiles.
    inputModerationRequired: isMinor,
    outputModerationRequired: isMinor,
    denyReason: tutorAllowed ? null : "CONSENT_REQUIRED",
  };
}

/**
 * Decides what conversation history may be replayed into the next prompt.
 *
 * §3.6: no long-term AI memory under 13, and teen memory is opt-in only. When
 * memory is not allowed the prior turns are not replayed at all — the model sees
 * only the current message. Extracted as a pure function so the rule is directly
 * testable without invoking a provider.
 */
export function replayableHistory(
  profile: SafetyProfile,
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
  windowSize = 12,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!profile.longTermMemoryAllowed) {
    return [{ role: "user", content: currentMessage }];
  }
  return history
    .filter((item): item is { role: "user" | "assistant"; content: string } => item.role !== "system")
    .slice(-windowSize);
}

/** Safety sections appended to the system prompt for minor-facing profiles. */
export function safetyPromptSection(profile: SafetyProfile) {
  if (!profile.isMinor) return null;
  return [
    "This learner is a minor. Use age-appropriate language and examples throughout.",
    "Refuse and redirect any request involving self-harm, sexual content, violence, illegal activity, hate, or personal contact details.",
    "Do not ask for or repeat personal information such as address, phone number, school name, or photographs.",
    "Keep the conversation on the supplied learning material; redirect off-topic conversation back to it.",
  ].join(" ");
}
