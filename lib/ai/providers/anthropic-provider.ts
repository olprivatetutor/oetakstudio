import { BaseAiProvider } from "@/lib/ai/providers/base";
import type { AiGenerationRequest } from "@/lib/ai/types";

type AnthropicResponse = {
  model: string;
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
};

export class AnthropicProvider extends BaseAiProvider {
  readonly name = "anthropic";
  readonly defaultModel = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

  async generate(request: AiGenerationRequest) {
    const apiKey = this.requireApiKey(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
    const model = request.model ?? this.defaultModel;
    const { data, responseTimeMs } = await this.postJson<AnthropicResponse>(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      {
        model,
        system: request.systemPrompt,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 800,
        temperature: request.temperature ?? 0.3,
      },
    );
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    return {
      text: data.content.filter((item) => item.type === "text").map((item) => item.text ?? "").join(""),
      provider: this.name,
      model: data.model ?? model,
      inputTokens,
      outputTokens,
      costMicros: this.calculateCostMicros(inputTokens, outputTokens),
      responseTimeMs,
      finishReason: data.stop_reason,
    };
  }

  getCapabilities() {
    return { streaming: true, vision: true, audio: false, functionCalling: true };
  }
}
