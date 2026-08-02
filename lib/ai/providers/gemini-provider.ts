import { BaseAiProvider } from "@/lib/ai/providers/base";
import type { AiGenerationRequest } from "@/lib/ai/types";

type GeminiResponse = {
  modelVersion?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export class GeminiProvider extends BaseAiProvider {
  readonly name = "gemini";
  readonly defaultModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

  async generate(request: AiGenerationRequest) {
    const apiKey = this.requireApiKey(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");
    const model = request.model ?? this.defaultModel;
    const { data, responseTimeMs } = await this.postJson<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: request.messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens ?? 800,
        },
      },
    );
    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    const candidate = data.candidates?.[0];
    return {
      text: candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "",
      provider: this.name,
      model: data.modelVersion ?? model,
      inputTokens,
      outputTokens,
      costMicros: this.calculateCostMicros(inputTokens, outputTokens),
      responseTimeMs,
      finishReason: candidate?.finishReason,
    };
  }

  getCapabilities() {
    return { streaming: true, vision: true, audio: true, functionCalling: true };
  }
}
