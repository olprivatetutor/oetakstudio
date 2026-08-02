export type TextToSpeechInput = {
  text: string;
  voiceId?: string;
};

export type TextToSpeechResult = {
  audioBase64: string;
  mimeType: string;
  provider: string;
  model: string;
};

export interface TextToSpeechProvider {
  name: string;
  synthesize(input: TextToSpeechInput): Promise<TextToSpeechResult>;
}
