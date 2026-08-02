export type SpeechToTextInput = {
  audio: ArrayBuffer;
  mimeType: string;
  language?: string;
};

export type SpeechToTextResult = {
  transcript: string;
  confidence?: number;
  provider: string;
  model: string;
};

export interface SpeechToTextProvider {
  name: string;
  transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult>;
}
