"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApiResponse<T> = { success: true; data: T; message: string } | { success: false; error: { message: string } };

export function CurriculumForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");
    const payload = {
      code: String(form.get("code")),
      name: String(form.get("name")),
      track: "SCH",
      source: "system",
      regions: String(form.get("regions") || "").split(",").map((item) => item.trim()).filter(Boolean),
      characteristics: String(form.get("characteristics")),
      metadata: {},
    };
    try {
      const response = await fetch("/api/taxonomy/curricula", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse<unknown>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Curriculum could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Code</Label><Input name="code" placeholder="CUS" required /></div>
        <div className="space-y-2"><Label>Name</Label><Input name="name" placeholder="Custom Curriculum" required /></div>
        <div className="space-y-2 md:col-span-2"><Label>Regions</Label><Input name="regions" placeholder="Indonesia, International" /></div>
        <div className="space-y-2 md:col-span-2"><Label>Characteristics</Label><Textarea name="characteristics" required /></div>
      </div>
      <Button disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create curriculum</Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </form>
  );
}

export function LearningObjectiveForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");
    const payload = {
      objectiveId: String(form.get("objectiveId")),
      track: "SCH",
      curriculumCode: String(form.get("curriculumCode") || "MER"),
      levelCode: String(form.get("levelCode") || "SMP"),
      gradeLabel: String(form.get("gradeLabel") || "Kelas 8"),
      subjectCode: String(form.get("subjectCode") || "ENG"),
      topic: String(form.get("topic")),
      objective: String(form.get("objective")),
      bloomTaxonomy: String(form.get("bloomTaxonomy") || "Understanding"),
      assessmentTypes: String(form.get("assessmentTypes") || "Formative").split(",").map((item) => item.trim()).filter(Boolean),
      keywords: String(form.get("keywords") || "").split(",").map((item) => item.trim()).filter(Boolean),
      prerequisites: [],
    };
    try {
      const response = await fetch("/api/taxonomy/objectives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse<unknown>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Learning objective could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Objective ID</Label><Input name="objectiveId" placeholder="LO-ENG-8-002" required /></div>
        <div className="space-y-2"><Label>Curriculum</Label><Input name="curriculumCode" defaultValue="MER" required /></div>
        <div className="space-y-2"><Label>Level</Label><Input name="levelCode" defaultValue="SMP" required /></div>
        <div className="space-y-2"><Label>Grade</Label><Input name="gradeLabel" defaultValue="Kelas 8" required /></div>
        <div className="space-y-2"><Label>Subject</Label><Input name="subjectCode" defaultValue="ENG" required /></div>
        <div className="space-y-2"><Label>Bloom</Label><Input name="bloomTaxonomy" defaultValue="Understanding" required /></div>
        <div className="space-y-2 md:col-span-2"><Label>Topic</Label><Input name="topic" required /></div>
        <div className="space-y-2 md:col-span-2"><Label>Objective</Label><Textarea name="objective" required /></div>
        <div className="space-y-2 md:col-span-2"><Label>Keywords</Label><Input name="keywords" placeholder="narrative, orientation, resolution" /></div>
      </div>
      <Button disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create objective</Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </form>
  );
}
