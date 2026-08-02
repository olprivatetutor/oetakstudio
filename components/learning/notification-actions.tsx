"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkNotificationsReadButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  async function markRead() {
    if (ids.length === 0) return;
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    router.refresh();
  }
  return <Button variant="outline" size="sm" onClick={markRead} disabled={ids.length === 0}><CheckCheck className="h-4 w-4" />Mark read</Button>;
}
