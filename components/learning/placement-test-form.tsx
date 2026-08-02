"use client";

import { FormEvent, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ContentTrack } from "@/types/domain";

type Track = ContentTrack;
type Question = { id: string; learningObjectiveId: string | null; prompt: string; topic: string; expectedKeywords: string[] };
type Started = { test: { id: string; scope: string }; questions: Question[] };
type Submitted = { test: { score: number | null; recommendedLevel: string | null; scope: string }; responses: Array<{ question: string; score: number; feedback: string }> };
type ApiResponse<T> = { success: true; data: T; message: string } | { success: false; error: { message: string } };

export function PlacementTestForm() {
  const [track, setTrack] = useState<Track>("SCH");
  const [started, setStarted] = useState<Started | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");
    setSubmitted(null);

    const payload = {
      track,
      curriculumCode: String(form.get("curriculumCode") || "") || undefined,
      levelCode: String(form.get("levelCode") || "") || undefined,
      gradeLabel: String(form.get("gradeLabel") || "") || undefined,
      subjectCode: String(form.get("subjectCode") || "") || undefined,
      skillFramework: String(form.get("skillFramework") || "") || undefined,
    };

    try {
      const response = await fetch("/api/placement-tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse<Started>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setStarted(result.data);
      setAnswers(Object.fromEntries(result.data.questions.map((question) => [question.id, ""])));
    } catch {
      setError("Placement test could not be started.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswers() {
    if (!started) return;
    setIsLoading(true);
    setError("");
    try {
      const payload = {
        answers: started.questions.map((question) => ({
          question: question.prompt,
          answer: answers[question.id] || "",
          learningObjectiveId: question.learningObjectiveId,
        })),
      };
      const response = await fetch(`/api/placement-tests/${started.test.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse<Submitted>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSubmitted(result.data);
    } catch {
      setError("Placement answers could not be submitted.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit"><Sparkles className="h-3.5 w-3.5" />Adaptive placement</Badge>
          <CardTitle className="text-2xl">Start placement test</CardTitle>
          <CardDescription>School placement is scope-locked to curriculum learning objectives; non-school tracks use open proficiency.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Track</Label><Select value={track} onValueChange={(value: Track) => setTrack(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SCH">Formal School</SelectItem><SelectItem value="ESP">English for Specific Purposes</SelectItem><SelectItem value="LNP">Language Test Preparation</SelectItem><SelectItem value="LNG">General Language Learning</SelectItem><SelectItem value="PRO">Professional Skills</SelectItem><SelectItem value="GEN">General Enrichment</SelectItem></SelectContent></Select></div>
            {track === "SCH" ? <>
              <div className="space-y-2"><Label>Curriculum</Label><Input name="curriculumCode" defaultValue="MER" /></div>
              <div className="space-y-2"><Label>Level</Label><Input name="levelCode" defaultValue="SMA" /></div>
              <div className="space-y-2"><Label>Grade</Label><Input name="gradeLabel" defaultValue="Kelas 11" /></div>
              <div className="space-y-2"><Label>Subject</Label><Input name="subjectCode" defaultValue="MATH" /></div>
            </> : <>
              <div className="space-y-2"><Label>Subject / Focus</Label><Input name="subjectCode" defaultValue={["LNG", "LNP", "ESP"].includes(track) ? "ENG" : "Business"} /></div>
              <div className="space-y-2"><Label>Framework</Label><Input name="skillFramework" defaultValue={["LNG", "LNP", "ESP"].includes(track) ? "CEFR" : "Industry Benchmark"} /></div>
            </>}
            <div className="md:col-span-2"><Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Start test</Button></div>
          </form>
        </CardContent>
      </Card>

      {started && !submitted && (
        <Card>
          <CardHeader><CardTitle className="text-2xl">Answer questions</CardTitle><CardDescription>Scope: {started.test.scope}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {started.questions.map((question) => (
              <div key={question.id} className="space-y-2 rounded-[1.25rem] bg-muted/45 p-4">
                <Label>{question.topic}</Label>
                <p className="text-sm text-muted-foreground">{question.prompt}</p>
                <Textarea value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="min-h-24" />
              </div>
            ))}
            <Button onClick={submitAnswers} disabled={isLoading}><Send className="h-4 w-4" />Submit answers</Button>
          </CardContent>
        </Card>
      )}

      {submitted && (
        <Card>
          <CardHeader><CardTitle className="text-2xl">Placement result</CardTitle><CardDescription>Recommended level: {submitted.test.recommendedLevel}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-4xl font-semibold">{submitted.test.score}%</div>
            {submitted.responses.map((response, index) => <div key={index} className="rounded-[1rem] bg-muted/45 p-3 text-sm"><div className="font-semibold">{response.score}%</div><div className="text-muted-foreground">{response.feedback}</div></div>)}
          </CardContent>
        </Card>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}
