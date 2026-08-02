import { BaseAiProvider } from "@/lib/ai/providers/base";
import type { AiGenerationRequest } from "@/lib/ai/types";

type DeepSeekResponse = {
  model: string;
  choices: Array<{ finish_reason?: string; message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class DeepSeekProvider extends BaseAiProvider {
  readonly name = "deepseek";
  readonly defaultModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

  async generate(request: AiGenerationRequest) {
    const apiKey = this.requireApiKey(process.env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY");
    const model = request.model ?? this.defaultModel;
    const { data, responseTimeMs } = await this.postJson<DeepSeekResponse>(
      "https://api.deepseek.com/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        messages: [{ role: "system", content: request.systemPrompt }, ...request.messages],
        max_tokens: request.maxTokens ?? 800,
        temperature: request.temperature ?? 0.3,
        stream: false,
      },
    );
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    return {
      text: data.choices[0]?.message?.content ?? "",
      provider: this.name,
      model: data.model ?? model,
      inputTokens,
      outputTokens,
      costMicros: this.calculateCostMicros(inputTokens, outputTokens),
      responseTimeMs,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  getCapabilities() {
    return { streaming: true, vision: false, audio: false, functionCalling: true };
  }
}
