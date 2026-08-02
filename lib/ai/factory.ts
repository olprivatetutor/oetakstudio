import { AppError } from "@/lib/api/response";
import type { AiProvider } from "@/lib/ai/types";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic-provider";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek-provider";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { OpenAiProvider } from "@/lib/ai/providers/openai-provider";

export function createAiProvider(provider = process.env.LLM_PROVIDER ?? "openai"): AiProvider {
  if (provider === "openai") return new OpenAiProvider();
  if (provider === "anthropic") return new AnthropicProvider();
  if (provider === "gemini") return new GeminiProvider();
  if (provider === "deepseek") return new DeepSeekProvider();
  throw new AppError("INTERNAL_ERROR", `Unsupported LLM provider: ${provider}`, 500);
}

export function createAiProviderChain() {
  const providers = [
    process.env.LLM_PROVIDER ?? "openai",
    ...(process.env.LLM_FALLBACK_PROVIDERS ?? "")
      .split(",")
      .map((provider) => provider.trim())
      .filter(Boolean),
  ];
  return [...new Set(providers)].map(createAiProvider);
}
