"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AccountType = "individual" | "organization";
type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function OnboardingForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");

    const payload = {
      accountType,
      headline: String(form.get("headline") || ""),
      goals: String(form.get("goals") || "").split(",").map((item) => item.trim()).filter(Boolean),
      interests: String(form.get("interests") || "").split(",").map((item) => item.trim()).filter(Boolean),
      proficiencyLevel: String(form.get("proficiencyLevel") || "beginner"),
      targetStudyMinutes: Number(form.get("targetStudyMinutes") || 120),
      organization: accountType === "organization" ? {
        name: String(form.get("organizationName") || ""),
        slug: String(form.get("organizationSlug") || ""),
        description: String(form.get("organizationDescription") || ""),
      } : undefined,
    };

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } catch {
      setError("Onboarding could not be saved.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[1.5rem] border bg-card/52 p-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Account type</Label>
        <Select value={accountType} onValueChange={(value: AccountType) => setAccountType(value)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual learner</SelectItem>
            <SelectItem value="organization">Organization owner</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="headline">Learning headline</Label>
        <Input id="headline" name="headline" placeholder="IELTS learner, frontend developer, school operator" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goals">Goals</Label>
        <Input id="goals" name="goals" placeholder="Band 7.5, React, Trigonometry" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interests">Interests</Label>
        <Input id="interests" name="interests" placeholder="Math, programming, language" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="proficiencyLevel">Proficiency</Label>
        <Input id="proficiencyLevel" name="proficiencyLevel" defaultValue="beginner" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetStudyMinutes">Weekly study minutes</Label>
        <Input id="targetStudyMinutes" name="targetStudyMinutes" type="number" defaultValue={120} min={15} max={1200} />
      </div>
      {accountType === "organization" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization name</Label>
            <Input id="organizationName" name="organizationName" required={accountType === "organization"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organizationSlug">Slug</Label>
            <Input id="organizationSlug" name="organizationSlug" placeholder="nihongo-center" required={accountType === "organization"} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="organizationDescription">Description</Label>
            <Textarea id="organizationDescription" name="organizationDescription" />
          </div>
        </>
      )}
      <div className="space-y-3 md:col-span-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save onboarding
        </Button>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </div>
    </form>
  );
}
