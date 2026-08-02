"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ContentTrack, OrganizationType } from "@/types/domain";

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function OrganizationForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<OrganizationType>("institution");
  const [primaryContentTrack, setPrimaryContentTrack] = useState<ContentTrack>("PRO");
  const [curriculumMode, setCurriculumMode] = useState<"inherited" | "custom">("inherited");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name")),
          slug: String(form.get("slug")),
          description: String(form.get("description") || ""),
          brandColor: String(form.get("brandColor") || "#2563eb"),
          type,
          primaryContentTrack: type === "school" ? "SCH" : primaryContentTrack,
          curriculumMode: type === "school" ? curriculumMode : "inherited",
        }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Organization could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[1.5rem] border bg-card/52 p-4 md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
      <div className="space-y-2"><Label htmlFor="slug">Slug</Label><Input id="slug" name="slug" placeholder="tech-academy" required /></div>
      <div className="space-y-2"><Label htmlFor="brandColor">Brand color</Label><Input id="brandColor" name="brandColor" defaultValue="#2563eb" /></div>
      <div className="space-y-2"><Label>Organization type</Label><Select value={type} onValueChange={(value: OrganizationType) => setType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="school">School</SelectItem><SelectItem value="corporate">Corporate</SelectItem><SelectItem value="institution">Institution</SelectItem></SelectContent></Select></div>
      {type === "school" ? <div className="space-y-2"><Label>Curriculum mode</Label><Select value={curriculumMode} onValueChange={(value: "inherited" | "custom") => setCurriculumMode(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherited">Inherit system curricula</SelectItem><SelectItem value="custom">Custom school curriculum</SelectItem></SelectContent></Select></div> : <div className="space-y-2"><Label>Primary track</Label><Select value={primaryContentTrack} onValueChange={(value: ContentTrack) => setPrimaryContentTrack(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ESP">English for Specific Purposes</SelectItem><SelectItem value="LNP">Language Test Preparation</SelectItem><SelectItem value="LNG">General Language Learning</SelectItem><SelectItem value="PRO">Professional Skills</SelectItem><SelectItem value="GEN">General Enrichment</SelectItem></SelectContent></Select></div>}
      <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" /></div>
      <div className="space-y-3 md:col-span-2">
        <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create organization</Button>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </div>
    </form>
  );
}
