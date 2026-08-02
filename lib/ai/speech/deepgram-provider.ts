import { AppError } from "@/lib/api/response";
import type { SpeechToTextInput, SpeechToTextProvider, SpeechToTextResult } from "@/lib/ai/speech/speech-provider";

type DeepgramResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
      }>;
    }>;
  };
};

export class DeepgramSpeechToTextProvider implements SpeechToTextProvider {
  name = "deepgram";
  private readonly apiKey: string;
  private readonly model = "nova-3";

  constructor(apiKey = process.env.DEEPGRAM_API_KEY) {
    if (!apiKey) {
      throw new AppError("INTERNAL_ERROR", "DEEPGRAM_API_KEY is not configured", 500);
    }
    this.apiKey = apiKey;
  }

  async transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult> {
    const params = new URLSearchParams({ model: this.model, smart_format: "true" });
    if (input.language) params.set("language", input.language);

    const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": input.mimeType,
      },
      body: input.audio,
    });

    if (!response.ok) {
      throw new AppError("INTERNAL_ERROR", "Speech-to-text provider failed", 502, { provider: this.name, status: response.status });
    }

    const payload = (await response.json()) as DeepgramResponse;
    const alternative = payload.results?.channels?.[0]?.alternatives?.[0];
    return {
      transcript: alternative?.transcript ?? "",
      confidence: alternative?.confidence,
      provider: this.name,
      model: this.model,
    };
  }
}
