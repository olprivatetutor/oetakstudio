"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function EnrollButton({ courseId, enrolled }: { courseId: string; enrolled: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function enroll() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Enrollment failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (enrolled) {
    return <Button variant="secondary" disabled>Enrolled</Button>;
  }

  return (
    <div className="space-y-2">
      <Button onClick={enroll} disabled={isLoading} className="w-full sm:w-auto">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Enroll course
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
