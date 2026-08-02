export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiGenerationRequest = {
  systemPrompt: string;
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  safetyIdentifier?: string;
};

export type AiGenerationResult = {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  responseTimeMs: number;
  finishReason?: string;
};

export type AiCapabilities = {
  streaming: boolean;
  vision: boolean;
  audio: boolean;
  functionCalling: boolean;
};

export interface AiProvider {
  readonly name: string;
  readonly defaultModel: string;
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
  stream(request: AiGenerationRequest): AsyncIterable<string>;
  getCapabilities(): AiCapabilities;
}
