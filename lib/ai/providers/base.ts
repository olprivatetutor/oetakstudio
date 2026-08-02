import { AppError } from "@/lib/api/response";
import type {
  AiCapabilities,
  AiGenerationRequest,
  AiGenerationResult,
  AiProvider,
} from "@/lib/ai/types";

export abstract class BaseAiProvider implements AiProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;
  abstract generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
  abstract getCapabilities(): AiCapabilities;

  async *stream(request: AiGenerationRequest) {
    const response = await this.generate(request);
    yield response.text;
  }

  protected requireApiKey(value: string | undefined, variableName: string) {
    if (!value) {
      throw new AppError(
        "INTERNAL_ERROR",
        `${variableName} is required for the configured AI provider`,
        503,
      );
    }
    return value;
  }

  protected async postJson<T>(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ data: T; responseTimeMs: number }> {
    const startedAt = performance.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);
    const data = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
    if (!response.ok) {
      const message = data && typeof data === "object" && "error" in data && data.error?.message
        ? data.error.message
        : `AI provider returned HTTP ${response.status}`;
      throw new AppError("INTERNAL_ERROR", message, 502);
    }
    return { data: data as T, responseTimeMs };
  }

  protected calculateCostMicros(inputTokens: number, outputTokens: number) {
    const inputPerMillion = Number(process.env.AI_INPUT_COST_PER_MILLION_MICROS ?? 0);
    const outputPerMillion = Number(process.env.AI_OUTPUT_COST_PER_MILLION_MICROS ?? 0);
    return Math.round(
      (inputTokens * inputPerMillion + outputTokens * outputPerMillion) / 1_000_000,
    );
  }
}
