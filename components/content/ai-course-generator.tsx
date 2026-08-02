"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ContentTrack, CourseLevel } from "@/types/domain";

type OrganizationOption = { organizationId: string; name: string; role: string };
type ApiResult =
  | { success: true; data: { jobId: string; course: { id: string } } }
  | { success: false; error: { message: string } };

export function AiCourseGenerator({
  organizations,
  allowPlatformCatalog = false,
}: {
  organizations: OrganizationOption[];
  allowPlatformCatalog?: boolean;
}) {
  const router = useRouter();
  const [scope, setScope] = useState(allowPlatformCatalog ? "platform" : organizations[0]?.organizationId ?? "");
  const [contentTrack, setContentTrack] = useState<ContentTrack>("GEN");
  const [level, setLevel] = useState<CourseLevel>("beginner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowPlatformCatalog && !scope) {
      setError("Choose an organization before generating a course.");
      return;
    }
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: scope === "platform" ? null : scope,
          title: String(form.get("title")),
          sourceText: String(form.get("sourceText")),
          category: String(form.get("category")),
          language: String(form.get("language")),
          moduleCount: Number(form.get("moduleCount")),
          contentTrack,
          level,
        }),
      });
      const result = (await response.json()) as ApiResult;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.push(`/dashboard/courses/${result.data.course.id}`);
    } catch {
      setError("The course could not be generated. Check the configured AI provider and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ai-title">Course title</Label>
          <Input id="ai-title" name="title" required minLength={3} maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-category">Category</Label>
          <Input id="ai-category" name="category" placeholder="Mathematics" required />
        </div>
        <div className="space-y-2">
          <Label>Catalog scope</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue placeholder="Choose organization" /></SelectTrigger>
            <SelectContent>
              {allowPlatformCatalog && <SelectItem value="platform">Platform Content Library</SelectItem>}
              {organizations.map((organization) => (
                <SelectItem key={organization.organizationId} value={organization.organizationId}>{organization.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Content track</Label>
          <Select value={contentTrack} onValueChange={(value: ContentTrack) => setContentTrack(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SCH">Formal School</SelectItem>
              <SelectItem value="ESP">English for Specific Purposes</SelectItem>
              <SelectItem value="LNP">Language Test Preparation</SelectItem>
              <SelectItem value="LNG">General Language Learning</SelectItem>
              <SelectItem value="PRO">Professional Skills</SelectItem>
              <SelectItem value="GEN">General Enrichment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <Select value={level} onValueChange={(value: CourseLevel) => setLevel(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-language">Language</Label>
          <Input id="ai-language" name="language" defaultValue="English" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-module-count">Modules</Label>
          <Input id="ai-module-count" name="moduleCount" type="number" min={1} max={8} defaultValue={4} required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ai-source">Source material</Label>
          <Textarea id="ai-source" name="sourceText" minLength={50} maxLength={40000} className="min-h-64" required />
        </div>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate draft
      </Button>
    </form>
  );
}
