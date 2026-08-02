import { DeepgramSpeechToTextProvider } from "@/lib/ai/speech/deepgram-provider";
import type { SpeechToTextProvider } from "@/lib/ai/speech/speech-provider";
import { AppError } from "@/lib/api/response";

export function createSpeechToTextProvider(provider = process.env.STT_PROVIDER ?? "deepgram"): SpeechToTextProvider {
  if (provider === "deepgram") return new DeepgramSpeechToTextProvider();
  throw new AppError("INTERNAL_ERROR", `Unsupported STT provider: ${provider}`, 500);
}
