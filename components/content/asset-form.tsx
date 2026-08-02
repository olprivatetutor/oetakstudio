"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Kind = "video" | "audio" | "document" | "image" | "interactive" | "scorm" | "h5p" | "template";
type Status = "draft" | "review" | "approved" | "published" | "archived";
type ApiResponse<T> = { success: true; data: T; message: string } | { success: false; error: { message: string } };

export function AssetForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("document");
  const [status, setStatus] = useState<Status>("draft");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");
    const payload = {
      title: String(form.get("title")),
      description: String(form.get("description")),
      kind,
      status,
      sourceUrl: String(form.get("sourceUrl") || ""),
      tags: String(form.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
      metadata: {},
    };
    try {
      const response = await fetch("/api/content-assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse<unknown>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Content asset could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
      <div className="space-y-2"><Label>Source URL</Label><Input name="sourceUrl" type="url" placeholder="https://..." /></div>
      <div className="space-y-2"><Label>Kind</Label><Select value={kind} onValueChange={(value: Kind) => setKind(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">Document</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="audio">Audio</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="interactive">Interactive</SelectItem><SelectItem value="scorm">SCORM</SelectItem><SelectItem value="h5p">H5P</SelectItem><SelectItem value="template">Template</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={(value: Status) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
      <div className="space-y-2 md:col-span-2"><Label>Tags</Label><Input name="tags" placeholder="MATH, MER, interactive" /></div>
      <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea name="description" className="min-h-24" required /></div>
      <div className="space-y-3 md:col-span-2"><Button disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create asset</Button>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</div>
    </form>
  );
}
