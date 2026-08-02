import { ElevenLabsTextToSpeechProvider } from "@/lib/ai/tts/elevenlabs-provider";
import type { TextToSpeechProvider } from "@/lib/ai/tts/tts-provider";
import { AppError } from "@/lib/api/response";

export function createTextToSpeechProvider(provider = process.env.TTS_PROVIDER ?? "elevenlabs"): TextToSpeechProvider {
  if (provider === "elevenlabs") return new ElevenLabsTextToSpeechProvider();
  throw new AppError("INTERNAL_ERROR", `Unsupported TTS provider: ${provider}`, 500);
}
