"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatOrganizationRole } from "@/lib/role-labels";
import type { ContentTrack, OrganizationRole } from "@/types/domain";

type ModuleDraft = {
  title: string;
  summary: string;
  type: "video" | "reading" | "interactive" | "quiz" | "assignment";
  content: string;
  estimatedMinutes: number;
};

type OrganizationOption = { organizationId: string; name: string; role: OrganizationRole };
type CreatedCourse = { course: { id: string } };
type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

const initialModule: ModuleDraft = {
  title: "Introduction",
  summary: "Set context, outcomes, and key concepts for the learner.",
  type: "reading",
  content: "Describe the lesson content, examples, and practice task for this module.",
  estimatedMinutes: 20,
};

export function CourseForm({
  organizations,
  allowPlatformCatalog = false,
}: {
  organizations: OrganizationOption[];
  allowPlatformCatalog?: boolean;
}) {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleDraft[]>([initialModule]);
  const [catalogScope, setCatalogScope] = useState<string>(allowPlatformCatalog ? "platform" : organizations[0]?.organizationId ?? "");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [contentTrack, setContentTrack] = useState<ContentTrack>("GEN");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [correctOptionId, setCorrectOptionId] = useState("a");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function updateModule(index: number, patch: Partial<ModuleDraft>) {
    setModules((current) => current.map((module, itemIndex) => itemIndex === index ? { ...module, ...patch } : module));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");

    if (!allowPlatformCatalog && !catalogScope) {
      setIsLoading(false);
      setError("Choose an organization before creating a course.");
      return;
    }

    try {
      const payload = {
        organizationId: catalogScope === "platform" ? null : catalogScope,
        title: String(form.get("title")),
        slug: String(form.get("slug")),
        description: String(form.get("description")),
        category: String(form.get("category")),
        contentTrack,
        curriculumCode: String(form.get("curriculumCode") || "") || null,
        schoolLevel: String(form.get("schoolLevel") || "") || null,
        gradeLabel: String(form.get("gradeLabel") || "") || null,
        subjectCode: String(form.get("subjectCode") || "") || null,
        skillFramework: String(form.get("skillFramework") || "") || null,
        level,
        status,
        aiGenerated: Boolean(form.get("aiGenerated")),
        priceCents: Number(form.get("priceCents") || 0),
        estimatedMinutes: modules.reduce((sum, module) => sum + module.estimatedMinutes, 0),
        modules,
        assessment: {
          title: String(form.get("assessmentTitle")),
          purpose: "formative",
          passingScore: Number(form.get("passingScore") || 70),
          maxAttempts: Number(form.get("maxAttempts") || 3),
          questions: [{
            id: crypto.randomUUID(),
            type: "multiple_choice",
            prompt: String(form.get("assessmentPrompt")),
            options: ["a", "b", "c", "d"].map((id) => ({
              id,
              label: String(form.get(`option-${id}`)),
            })),
            correctOptionIds: [correctOptionId],
            points: 100,
            feedback: String(form.get("assessmentFeedback") || ""),
          }],
        },
      };

      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse<CreatedCourse>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      router.push(`/dashboard/courses/${result.data.course.id}`);
    } catch {
      setError("Course could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
        <div className="space-y-2"><Label htmlFor="slug">Slug</Label><Input id="slug" name="slug" placeholder="adaptive-math-basics" required /></div>
        <div className="space-y-2"><Label htmlFor="category">Category</Label><Input id="category" name="category" placeholder="Mathematics" required /></div>
        <div className="space-y-2"><Label>Content track</Label><Select value={contentTrack} onValueChange={(value: ContentTrack) => setContentTrack(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SCH">Formal School</SelectItem><SelectItem value="ESP">English for Specific Purposes</SelectItem><SelectItem value="LNP">Language Test Preparation</SelectItem><SelectItem value="LNG">General Language Learning</SelectItem><SelectItem value="PRO">Professional Skills</SelectItem><SelectItem value="GEN">General Enrichment</SelectItem></SelectContent></Select></div>
        <div className="space-y-2">
          <Label>Catalog scope</Label>
          <Select value={catalogScope} onValueChange={setCatalogScope}>
            <SelectTrigger><SelectValue placeholder="Choose organization" /></SelectTrigger>
            <SelectContent>
              {allowPlatformCatalog && <SelectItem value="platform">Platform Content Library</SelectItem>}
              {organizations.map((org) => (
                <SelectItem key={org.organizationId} value={org.organizationId}>{org.name} · {formatOrganizationRole(org.role)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {contentTrack === "SCH" && <>
          <div className="space-y-2"><Label htmlFor="curriculumCode">Curriculum</Label><Input id="curriculumCode" name="curriculumCode" placeholder="MER, CAM, IB" /></div>
          <div className="space-y-2"><Label htmlFor="schoolLevel">School level</Label><Input id="schoolLevel" name="schoolLevel" placeholder="SMP, SMA, IGCSE" /></div>
          <div className="space-y-2"><Label htmlFor="gradeLabel">Grade</Label><Input id="gradeLabel" name="gradeLabel" placeholder="Kelas 8, Year 10" /></div>
          <div className="space-y-2"><Label htmlFor="subjectCode">Subject</Label><Input id="subjectCode" name="subjectCode" placeholder="MATH, ENG, SCI" /></div>
        </>}
        {contentTrack !== "SCH" && <div className="space-y-2"><Label htmlFor="skillFramework">Skill framework</Label><Input id="skillFramework" name="skillFramework" placeholder="CEFR, ACTFL, Industry Benchmark" /></div>}
        <div className="space-y-2"><Label>Level</Label><Select value={level} onValueChange={(value: "beginner" | "intermediate" | "advanced") => setLevel(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={(value: "draft" | "published" | "archived") => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="priceCents">Price in cents</Label><Input id="priceCents" name="priceCents" type="number" min={0} defaultValue={0} /></div>
        <label className="flex items-center gap-2 pt-7 text-sm"><input name="aiGenerated" type="checkbox" className="size-4" />AI assisted content</label>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" className="min-h-28" required /></div>
      </div>

      <fieldset className="space-y-4 rounded-[1.25rem] border bg-card/56 p-4 shadow-[var(--shadow-xs)]">
        <legend className="px-2 text-lg font-semibold">Checkpoint assessment</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="assessmentTitle">Title</Label><Input id="assessmentTitle" name="assessmentTitle" defaultValue="Course checkpoint" required /></div>
          <div className="space-y-2"><Label htmlFor="passingScore">Passing score</Label><Input id="passingScore" name="passingScore" type="number" min={0} max={100} defaultValue={70} required /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="assessmentPrompt">Question</Label><Textarea id="assessmentPrompt" name="assessmentPrompt" className="min-h-24" required /></div>
          {["a", "b", "c", "d"].map((id, index) => <div key={id} className="space-y-2"><Label htmlFor={`option-${id}`}>Option {index + 1}</Label><Input id={`option-${id}`} name={`option-${id}`} required /></div>)}
          <div className="space-y-2"><Label>Correct option</Label><Select value={correctOptionId} onValueChange={setCorrectOptionId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["a", "b", "c", "d"].map((id, index) => <SelectItem key={id} value={id}>Option {index + 1}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="maxAttempts">Maximum attempts</Label><Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={20} defaultValue={3} required /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="assessmentFeedback">Answer feedback</Label><Textarea id="assessmentFeedback" name="assessmentFeedback" /></div>
        </div>
      </fieldset>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Modules</h2><Button type="button" variant="outline" onClick={() => setModules((current) => [...current, initialModule])}><Plus className="h-4 w-4" />Add module</Button></div>
        {modules.map((module, index) => (
          <div key={index} className="space-y-4 rounded-[1.25rem] border bg-card/56 p-4 shadow-[var(--shadow-xs)]">
            <div className="flex items-center justify-between gap-3"><div className="font-medium">Module {index + 1}</div>{modules.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => setModules((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /><span className="sr-only">Remove module</span></Button>}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Title</Label><Input value={module.title} onChange={(event) => updateModule(index, { title: event.target.value })} required /></div>
              <div className="space-y-2"><Label>Type</Label><Select value={module.type} onValueChange={(value: ModuleDraft["type"]) => updateModule(index, { type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reading">Reading</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="interactive">Interactive</SelectItem><SelectItem value="quiz">Quiz</SelectItem><SelectItem value="assignment">Assignment</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Minutes</Label><Input type="number" min={5} value={module.estimatedMinutes} onChange={(event) => updateModule(index, { estimatedMinutes: Number(event.target.value) })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Summary</Label><Textarea value={module.summary} onChange={(event) => updateModule(index, { summary: event.target.value })} required /></div>
              <div className="space-y-2 md:col-span-2"><Label>Content</Label><Textarea value={module.content} onChange={(event) => updateModule(index, { content: event.target.value })} className="min-h-28" required /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Create course</Button>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </div>
    </form>
  );
}
