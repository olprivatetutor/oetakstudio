import { AppError } from "@/lib/api/response";
import type { TextToSpeechInput, TextToSpeechProvider, TextToSpeechResult } from "@/lib/ai/tts/tts-provider";

export class ElevenLabsTextToSpeechProvider implements TextToSpeechProvider {
  name = "elevenlabs";
  private readonly apiKey: string;
  private readonly model = "eleven_turbo_v2_5";
  private readonly defaultVoiceId: string;

  constructor(apiKey = process.env.ELEVENLABS_API_KEY, defaultVoiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM") {
    if (!apiKey) {
      throw new AppError("INTERNAL_ERROR", "ELEVENLABS_API_KEY is not configured", 500);
    }
    this.apiKey = apiKey;
    this.defaultVoiceId = defaultVoiceId;
  }

  async synthesize(input: TextToSpeechInput): Promise<TextToSpeechResult> {
    const voiceId = input.voiceId || this.defaultVoiceId;
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: this.model,
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      throw new AppError("INTERNAL_ERROR", "Text-to-speech provider failed", 502, { provider: this.name, status: response.status });
    }

    const audio = await response.arrayBuffer();
    return {
      audioBase64: Buffer.from(audio).toString("base64"),
      mimeType: "audio/mpeg",
      provider: this.name,
      model: this.model,
    };
  }
}
