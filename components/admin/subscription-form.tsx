"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Plan = "free" | "personal" | "team" | "professional" | "enterprise" | "school" | "university";
type Status = "trialing" | "active" | "past_due" | "paused" | "canceled";
type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function SubscriptionForm({
  subscriptionId,
  plan,
  status,
  seats,
  billingEmail,
  currentPeriodEnd,
  notes,
}: {
  subscriptionId: string;
  plan: Plan;
  status: Status;
  seats: number;
  billingEmail?: string | null;
  currentPeriodEnd?: Date | string | null;
  notes?: string | null;
}) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan>(plan);
  const [selectedStatus, setSelectedStatus] = useState<Status>(status);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          status: selectedStatus,
          seats: Number(form.get("seats") || 1),
          billingEmail: String(form.get("billingEmail") || ""),
          currentPeriodEnd: String(form.get("currentPeriodEnd") || ""),
          notes: String(form.get("notes") || ""),
        }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Subscription could not be updated.");
    } finally {
      setIsLoading(false);
    }
  }

  const dateValue = currentPeriodEnd ? new Date(currentPeriodEnd).toISOString().slice(0, 10) : "";

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-[1.25rem] border bg-card/50 p-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Plan</Label>
        <Select value={selectedPlan} onValueChange={(value: Plan) => setSelectedPlan(value)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
            <SelectItem value="school">School</SelectItem>
            <SelectItem value="university">University</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={selectedStatus} onValueChange={(value: Status) => setSelectedStatus(value)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`seats-${subscriptionId}`}>Seats</Label>
        <Input id={`seats-${subscriptionId}`} name="seats" type="number" min={1} defaultValue={seats} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`period-${subscriptionId}`}>Period end</Label>
        <Input id={`period-${subscriptionId}`} name="currentPeriodEnd" type="date" defaultValue={dateValue} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`billing-${subscriptionId}`}>Billing email</Label>
        <Input id={`billing-${subscriptionId}`} name="billingEmail" type="email" defaultValue={billingEmail ?? ""} placeholder="billing@example.com" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`notes-${subscriptionId}`}>Notes</Label>
        <Textarea id={`notes-${subscriptionId}`} name="notes" defaultValue={notes ?? ""} placeholder="Internal subscription notes" />
      </div>
      <div className="space-y-3 md:col-span-2">
        <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Save subscription</Button>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </div>
    </form>
  );
}
