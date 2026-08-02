"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ApiResponse =
  | { success: true; message: string }
  | { success: false; error: { message: string } };

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/v1/organizations/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = (await response.json()) as ApiResponse;
    if (!result.success) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    router.replace("/dashboard/organization");
    router.refresh();
  }

  return <div className="space-y-4"><Button onClick={accept} disabled={isLoading || !token}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Accept invitation</Button>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</div>;
}
