import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { AppError, handleRouteError, successResponse } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { createTextToSpeechProvider } from "@/lib/ai/tts/factory";
import { blockedResponseMessage, createModerationProvider } from "@/lib/ai/moderation";
import { assertAiFeatureAllowed } from "@/lib/ai/safety";
import { textToSpeechSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const rateLimit = checkRateLimit(`ai:tts:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) throw new AppError("RATE_LIMITED", "Text-to-speech request limit reached", 429, { retryAfterMs: rateLimit.retryAfterMs });

    // §3.6/§12.11: consent gate before any provider exists, so a refused request
    // never reaches a third party.
    const safety = await assertAiFeatureAllowed(user.id, "text_to_speech");

    const input = textToSpeechSchema.parse(await request.json());

    // Minor-facing input is moderated before synthesis — the text is sent to an
    // external provider, so this must happen before the provider is invoked.
    if (safety.inputModerationRequired) {
      const moderator = createModerationProvider();
      const verdict = await moderator.moderate(input.text, { minorFacing: safety.isMinor });
      if (verdict.flagged) {
        throw new AppError(
          "VALIDATION_ERROR",
          blockedResponseMessage(verdict.categories),
          400,
          // Categories only — never the offending text verbatim (§12.11).
          { moderation: verdict.categories, safetyProfile: safety.profileId },
        );
      }
    }

    const provider = createTextToSpeechProvider();
    const result = await provider.synthesize(input);
    return successResponse(result, "Speech audio generated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
