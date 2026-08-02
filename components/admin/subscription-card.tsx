import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionForm } from "@/components/admin/subscription-form";

export type SubscriptionCardProps = {
  id: string;
  title: string;
  description: string;
  plan: "free" | "personal" | "team" | "professional" | "enterprise" | "school" | "university";
  status: "trialing" | "active" | "past_due" | "paused" | "canceled";
  seats: number;
  billingEmail?: string | null;
  currentPeriodEnd?: Date | string | null;
  notes?: string | null;
  meta?: string;
};

function formatDate(value?: Date | string | null) {
  if (!value) return "No period end";
  return new Date(value).toLocaleDateString();
}

export function SubscriptionCard({
  id,
  title,
  description,
  plan,
  status,
  seats,
  billingEmail,
  currentPeriodEnd,
  notes,
  meta,
}: SubscriptionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description} · {formatDate(currentPeriodEnd)}</CardDescription>
            {meta && <p className="mt-2 text-xs font-medium text-muted-foreground">{meta}</p>}
          </div>
          <div className="flex flex-wrap gap-2"><Badge>{plan}</Badge><Badge variant="secondary">{status}</Badge></div>
        </div>
      </CardHeader>
      <CardContent>
        <SubscriptionForm
          subscriptionId={id}
          plan={plan}
          status={status}
          seats={seats}
          billingEmail={billingEmail}
          currentPeriodEnd={currentPeriodEnd}
          notes={notes}
        />
      </CardContent>
    </Card>
  );
}
