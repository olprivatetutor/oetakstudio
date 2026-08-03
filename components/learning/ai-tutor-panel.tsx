"use client";

import { FormEvent, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type TutorResponse = {
  conversationId: string;
  answer: string;
  suggestions: string[];
  usage: { provider: string; tokensUsed: number };
};

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function AiTutorPanel({ courseId, moduleId }: { courseId: string; moduleId?: string }) {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [usage, setUsage] = useState<TutorResponse["usage"]>();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/ai/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, moduleId, conversationId, message }),
      });
      const result = (await response.json()) as ApiResponse<TutorResponse>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setConversationId(result.data.conversationId);
      setAnswer(result.data.answer);
      setSuggestions(result.data.suggestions);
      setUsage(result.data.usage);
      setMessage("");
    } catch {
      setError("AI tutor is unavailable right now.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[1.5rem] border bg-card/78 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <Bot className="h-5 w-5" />
          AI Tutor
        </div>
        {usage && <Badge variant="secondary">{usage.provider} · {usage.tokensUsed} tokens</Badge>}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask for an explanation, practice questions, or feedback."
          disabled={isLoading}
          required
          className="min-h-24"
        />
        <Button type="submit" disabled={isLoading || message.trim().length < 2}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask tutor
        </Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {answer && (
        <div className="space-y-3 rounded-[1.25rem] bg-muted/70 p-4 text-sm leading-6">
          <p>{answer}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Badge key={suggestion} variant="outline">{suggestion}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
