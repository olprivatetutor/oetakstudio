"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCirclePlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApiResponse<T> = { success: true; data: T; message: string } | { success: false; error: { message: string } };

export function DiscussionForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/discussions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: String(form.get("title")), content: String(form.get("content")), visibility: "private" }) });
      const result = (await response.json()) as ApiResponse<unknown>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Discussion could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
      <div className="space-y-2"><Label>Message</Label><Textarea name="content" className="min-h-28" required /></div>
      <Button disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCirclePlus className="h-4 w-4" />}Create discussion</Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </form>
  );
}
