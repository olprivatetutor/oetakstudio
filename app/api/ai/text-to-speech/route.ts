import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { AppError, handleRouteError, successResponse } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { createTextToSpeechProvider } from "@/lib/ai/tts/factory";
import { textToSpeechSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const rateLimit = checkRateLimit(`ai:tts:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) throw new AppError("RATE_LIMITED", "Text-to-speech request limit reached", 429, { retryAfterMs: rateLimit.retryAfterMs });

    const input = textToSpeechSchema.parse(await request.json());
    const provider = createTextToSpeechProvider();
    const result = await provider.synthesize(input);
    return successResponse(result, "Speech audio generated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
