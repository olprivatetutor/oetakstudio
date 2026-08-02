"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CourseStatus } from "@/types/domain";

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function CourseStatusForm({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<CourseStatus>(status);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Course status could not be updated.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[1.25rem] border bg-card/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedStatus} onValueChange={(value: CourseStatus) => setSelectedStatus(value)}>
          <SelectTrigger className="h-10 min-w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_review">In review</SelectItem>
            <SelectItem value="needs_revision">Needs revision</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={save} disabled={isLoading || selectedStatus === status}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save status
        </Button>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}
