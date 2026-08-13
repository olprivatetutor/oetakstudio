/**
 * Moderation capability (§12 capability list, §12.11).
 *
 * §12.11 requires moderation on BOTH input and output for minor-facing
 * profiles. This is a capability interface with a deterministic default
 * implementation, not a provider integration: business code depends on
 * `ModerationProvider`, never on a vendor SDK (§12, AGENTS.md §22), so a hosted
 * moderation endpoint can replace the default without touching call sites.
 *
 * The default is rule-based and intentionally conservative in what it claims: it
 * catches explicit high-signal categories and is not a substitute for a hosted
 * classifier. It exists so the §12.11 control is real and testable now rather
 * than deferred; swapping in a provider is configuration, not a rewrite.
 */

export type ModerationCategory =
  | "self_harm"
  | "sexual"
  | "violence"
  | "hate"
  | "illegal"
  | "personal_data";

export type ModerationResult = {
  flagged: boolean;
  categories: ModerationCategory[];
  provider: string;
};

export interface ModerationProvider {
  readonly name: string;
  moderate(text: string, context: { minorFacing: boolean }): Promise<ModerationResult>;
}

const PATTERNS: Array<{ category: ModerationCategory; pattern: RegExp }> = [
  { category: "self_harm", pattern: /\b(kill myself|suicide|self[-\s]?harm|cut myself|end my life)\b/i },
  { category: "sexual", pattern: /\b(porn|pornographic|sexually explicit|nude photos?|sext)\b/i },
  { category: "violence", pattern: /\b(how to (make|build) a (bomb|weapon)|shoot up|kill (him|her|them))\b/i },
  { category: "hate", pattern: /\b(racial slur|ethnic cleansing|gas the)\b/i },
  { category: "illegal", pattern: /\b(buy (drugs|cocaine|meth)|how to (steal|shoplift)|make (meth|methamphetamine))\b/i },
  // Minor-facing only: soliciting or disclosing contact details (§13).
  { category: "personal_data", pattern: /\b(what is your (address|phone)|my home address is|meet me at|send me a photo of yourself)\b/i },
];

export class RuleBasedModerationProvider implements ModerationProvider {
  readonly name = "rule-based";

  async moderate(text: string, context: { minorFacing: boolean }): Promise<ModerationResult> {
    const categories: ModerationCategory[] = [];
    for (const { category, pattern } of PATTERNS) {
      if (category === "personal_data" && !context.minorFacing) continue;
      if (pattern.test(text)) categories.push(category);
    }
    return { flagged: categories.length > 0, categories, provider: this.name };
  }
}

export function createModerationProvider(
  provider = process.env.AI_MODERATION_PROVIDER ?? "rule-based",
): ModerationProvider {
  // Only the deterministic default exists today. Additional providers are
  // registered here so no business module ever selects one.
  if (provider === "rule-based") return new RuleBasedModerationProvider();
  return new RuleBasedModerationProvider();
}

/**
 * §12.11: "A blocked response returns a supportive, age-appropriate message and
 * is logged without storing the offending content verbatim beyond the retention
 * window." Callers must use this rather than echoing the flagged text.
 */
export function blockedResponseMessage(categories: ModerationCategory[]) {
  if (categories.includes("self_harm")) {
    return (
      "I can't help with that here, and I'm sorry you're dealing with something this hard. " +
      "Please talk to an adult you trust or a local support service right away. " +
      "When you're ready, I'm here to help with your course material."
    );
  }
  return (
    "I can't help with that topic. Let's stay with your course material — " +
    "ask me anything about the current lesson and I'll walk you through it."
  );
}
