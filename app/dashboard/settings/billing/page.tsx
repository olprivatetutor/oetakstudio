import { requireUser } from "@/lib/api/session";
import { getBillingOverview, listBillingPlans } from "@/features/billing/service";
import { BillingPlans } from "@/components/billing/billing-plans";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function BillingSettingsPage() {
  const user = await requireUser();
  const [plans, billing] = await Promise.all([listBillingPlans(), getBillingOverview(user)]);
  const individual = billing.subscriptions.find((subscription) => subscription.subjectType === "individual" && subscription.subjectId === user.id);
  return <PageShell><PageHeader eyebrow="Settings" title="Billing" description="Manage your plan and review subscription status." /><BillingPlans plans={plans} subjectId={user.id} currentPlan={individual?.plan ?? "free"} /></PageShell>;
}
