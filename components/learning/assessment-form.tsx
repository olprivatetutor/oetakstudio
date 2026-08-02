"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AssessmentAnswer, AssessmentQuestion } from "@/types/domain";

type Submission = { score: number | null; feedback: string | null };
type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function AssessmentForm({
  assessmentId,
  enrollmentId,
  questions,
}: {
  assessmentId: string;
  enrollmentId?: string;
  questions: AssessmentQuestion[];
}) {
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [submission, setSubmission] = useState<Submission>();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!enrollmentId) {
    return <Alert><AlertDescription>Enroll in this course to submit assessments.</AlertDescription></Alert>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          ...(questions.length > 0
            ? { answers: questions.map((question) => answers[question.id]).filter(Boolean) }
            : { answer }),
        }),
      });
      const result = (await response.json()) as ApiResponse<Submission>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setSubmission(result.data);
      setAnswer("");
      setAnswers({});
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {questions.length === 0 ? (
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Write your answer or reflection here."
          className="min-h-28"
          disabled={isLoading}
          required
        />
      ) : questions.map((question, questionIndex) => (
        <fieldset key={question.id} className="space-y-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{questionIndex + 1}. {question.prompt}</legend>
          {["multiple_choice", "true_false"].includes(question.type) && (question.correctOptionIds?.length ?? 0) <= 1 ? (
            <RadioGroup
              value={answers[question.id]?.selectedOptionIds?.[0] ?? ""}
              onValueChange={(value) => setAnswers((current) => ({
                ...current,
                [question.id]: { questionId: question.id, selectedOptionIds: [value] },
              }))}
            >
              {question.options?.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <RadioGroupItem id={`${question.id}-${option.id}`} value={option.id} />
                  <Label htmlFor={`${question.id}-${option.id}`} className="font-normal">{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
          ) : ["multiple_choice", "true_false"].includes(question.type) ? (
            <div className="space-y-2">
              {question.options?.map((option) => {
                const selected = answers[question.id]?.selectedOptionIds ?? [];
                return <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${question.id}-${option.id}`}
                    checked={selected.includes(option.id)}
                    onCheckedChange={(checked) => setAnswers((current) => ({
                      ...current,
                      [question.id]: {
                        questionId: question.id,
                        selectedOptionIds: checked
                          ? [...selected, option.id]
                          : selected.filter((id) => id !== option.id),
                      },
                    }))}
                  />
                  <Label htmlFor={`${question.id}-${option.id}`} className="font-normal">{option.label}</Label>
                </div>;
              })}
            </div>
          ) : question.type === "fill_blank" ? (
            <Input
              value={answers[question.id]?.text ?? ""}
              onChange={(event) => setAnswers((current) => ({
                ...current,
                [question.id]: { questionId: question.id, text: event.target.value },
              }))}
              required
            />
          ) : (
            <Textarea
              value={answers[question.id]?.text ?? ""}
              onChange={(event) => setAnswers((current) => ({
                ...current,
                [question.id]: { questionId: question.id, text: event.target.value },
              }))}
              className="min-h-28"
              required
            />
          )}
        </fieldset>
      ))}
      <Button type="submit" disabled={isLoading || (questions.length === 0 && answer.trim().length < 2)}>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit assessment
      </Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {submission && (
        <div className="rounded-2xl border bg-card/58 p-4 text-sm shadow-[var(--shadow-xs)]">
          <Badge className="mb-2">{submission.score === null ? "Review pending" : `Score ${submission.score}/100`}</Badge>
          <p className="text-muted-foreground">{submission.feedback}</p>
        </div>
      )}
    </form>
  );
}
