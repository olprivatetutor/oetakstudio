"use client";

import { useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ApiResponse<T> = { success: true; data: T; message: string } | { success: false; error: { message: string } };

export function LibrarySaveButton({ assetId, courseId }: { assetId?: string; courseId?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId, courseId, tags: [] }) });
      const result = (await response.json()) as ApiResponse<unknown>;
      setSaved(result.success);
    } finally {
      setIsLoading(false);
    }
  }

  return <Button type="button" variant="outline" size="sm" onClick={save} disabled={isLoading || saved}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}{saved ? "Saved" : "Save"}</Button>;
}
