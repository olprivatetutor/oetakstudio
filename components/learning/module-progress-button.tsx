"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "not_started" | "in_progress" | "completed";

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function ModuleProgressButton({
  moduleId,
  enrollmentId,
  initialStatus,
  moduleHref,
}: {
  moduleId: string;
  enrollmentId?: string;
  initialStatus: Status;
  moduleHref?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status>(initialStatus);

  if (!enrollmentId) {
    return <Button variant="outline" disabled>Enroll first</Button>;
  }

  async function updateProgress(nextStatus: "in_progress" | "completed") {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/modules/${moduleId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          status: nextStatus,
          timeSpentMinutes: nextStatus === "completed" ? 20 : 5,
        }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (result.success) {
        setStatus(nextStatus);
        if (moduleHref) {
          router.push(moduleHref);
          return;
        }
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (status === "completed") {
    return (
      <Button
        variant="secondary"
        onClick={() => moduleHref ? router.push(moduleHref) : undefined}
        disabled={!moduleHref}
      >
        <CheckCircle2 className="h-4 w-4" />
        {moduleHref ? "Review" : "Complete"}
      </Button>
    );
  }

  if (status === "in_progress" && moduleHref) {
    return (
      <Button onClick={() => router.push(moduleHref)} disabled={isLoading}>
        <PlayCircle className="h-4 w-4" />
        Continue
      </Button>
    );
  }

  return (
    <Button
      variant={status === "in_progress" ? "default" : "outline"}
      onClick={() => updateProgress(status === "in_progress" ? "completed" : "in_progress")}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
      {status === "in_progress" ? "Mark complete" : "Start"}
    </Button>
  );
}
