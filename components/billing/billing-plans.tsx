"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubscriptionPlan } from "@/types/domain";

type Plan = {
  code: SubscriptionPlan;
  name: string;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  currency: string;
  includedSeats: number;
  features: string[];
};

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

export function BillingPlans({
  plans,
  subjectId,
  currentPlan,
}: {
  plans: Plan[];
  subjectId: string;
  currentPlan: SubscriptionPlan;
}) {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan>();
  const [error, setError] = useState("");

  async function subscribe(plan: SubscriptionPlan) {
    if (plan === "free" || plan === "enterprise") return;
    setLoadingPlan(plan);
    setError("");
    const response = await fetch("/api/v1/billing/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectType: "individual",
        subjectId,
        plan,
        interval: "monthly",
      }),
    });
    const result = (await response.json()) as ApiResponse<{ url: string }>;
    if (!result.success) {
      setError(result.error.message);
      setLoadingPlan(undefined);
      return;
    }
    window.location.assign(result.data.url);
  }

  return <div className="space-y-4">{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan) => <Card key={plan.code}><CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>{plan.name}</CardTitle>{plan.code === currentPlan && <Badge>Current</Badge>}</div><div className="text-2xl font-semibold">{plan.code === "enterprise" ? "Custom" : new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency, maximumFractionDigits: 0 }).format(plan.monthlyPriceCents / 100)}{plan.code !== "enterprise" && <span className="text-sm font-normal text-muted-foreground"> / month</span>}</div></CardHeader><CardContent className="space-y-2">{plan.features.map((feature) => <div key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{feature}</span></div>)}</CardContent><CardFooter><Button className="w-full" variant={plan.code === currentPlan ? "outline" : "default"} disabled={plan.code === currentPlan || plan.code === "free" || plan.code === "enterprise" || Boolean(loadingPlan)} onClick={() => void subscribe(plan.code)}>{loadingPlan === plan.code && <Loader2 className="h-4 w-4 animate-spin" />}{plan.code === "enterprise" ? "Contact sales" : plan.code === currentPlan ? "Current plan" : "Choose plan"}</Button></CardFooter></Card>)}</div></div>;
}
