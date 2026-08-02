import { BaseAiProvider } from "@/lib/ai/providers/base";
import type { AiGenerationRequest } from "@/lib/ai/types";

type OpenAiResponse = {
  model?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  status?: string;
};

export class OpenAiProvider extends BaseAiProvider {
  readonly name = "openai";
  readonly defaultModel = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

  async generate(request: AiGenerationRequest) {
    const apiKey = this.requireApiKey(process.env.OPENAI_API_KEY, "OPENAI_API_KEY");
    const model = request.model ?? this.defaultModel;
    const { data, responseTimeMs } = await this.postJson<OpenAiResponse>(
      "https://api.openai.com/v1/responses",
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        instructions: request.systemPrompt,
        input: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        max_output_tokens: request.maxTokens ?? 800,
        temperature: request.temperature ?? 0.3,
        store: false,
        safety_identifier: request.safetyIdentifier,
      },
    );
    const text = data.output_text ?? data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || Boolean(item.text))
      .map((item) => item.text ?? "")
      .join("") ?? "";
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    return {
      text,
      provider: this.name,
      model: data.model ?? model,
      inputTokens,
      outputTokens,
      costMicros: this.calculateCostMicros(inputTokens, outputTokens),
      responseTimeMs,
      finishReason: data.status,
    };
  }

  getCapabilities() {
    return { streaming: true, vision: true, audio: false, functionCalling: true };
  }
}
