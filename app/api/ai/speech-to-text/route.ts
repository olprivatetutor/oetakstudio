import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { AppError, handleRouteError, successResponse } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { createSpeechToTextProvider } from "@/lib/ai/speech/factory";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg"]);

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const rateLimit = checkRateLimit(`ai:stt:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) throw new AppError("RATE_LIMITED", "Speech-to-text request limit reached", 429, { retryAfterMs: rateLimit.retryAfterMs });

    const form = await request.formData();
    const file = form.get("audio");
    const language = String(form.get("language") || "").trim() || undefined;
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Audio file is required", 400);
    if (file.size > MAX_AUDIO_BYTES) throw new AppError("VALIDATION_ERROR", "Audio file exceeds 10MB", 400);
    if (!ALLOWED_AUDIO_TYPES.has(file.type)) throw new AppError("VALIDATION_ERROR", "Unsupported audio file type", 400, { type: file.type });

    const provider = createSpeechToTextProvider();
    const result = await provider.transcribe({ audio: await file.arrayBuffer(), mimeType: file.type, language });
    return successResponse(result, "Speech transcribed successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
