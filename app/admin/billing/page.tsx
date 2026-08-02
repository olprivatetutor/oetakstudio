import { BarChart3, CircleDollarSign, CreditCard, TrendingUp } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { formatCurrency, getAppAdminBilling } from "@/lib/services/app-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

const planOrder = ["free", "personal", "team", "professional", "school", "university", "enterprise"] as const;

export default async function AdminBillingPage() {
  const { user } = await requireAppOwnerPageUser();
  const data = await getAppAdminBilling(user);
  const rows = [...data.tenantSubscriptions, ...data.individualSubscriptions].filter((row) => row.subscriptionId && row.plan && row.status);
  const activeRows = rows.filter((row) => row.status === "active" || row.status === "trialing");
  const pastDueRows = rows.filter((row) => row.status === "past_due");
  const planCounts = planOrder.map((plan) => ({
    plan,
    count: rows.filter((row) => row.plan === plan).length,
    activeCount: activeRows.filter((row) => row.plan === plan).length,
  }));
  const largestPlanCount = Math.max(...planCounts.map((row) => row.count), 1);

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Billing operations"
        title="Billing health"
        description="Ringkasan komersial untuk owner: estimasi MRR, distribusi paket, risiko past due, dan katalog paket operasional."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Estimated MRR" value={formatCurrency(data.stats.monthlyRecurringCents)} icon={CircleDollarSign} />
        <MetricCard label="Billable records" value={rows.length} icon={CreditCard} tone="purple" />
        <MetricCard label="Active or trial" value={activeRows.length} icon={TrendingUp} tone="gold" />
        <MetricCard label="Past due" value={pastDueRows.length} icon={BarChart3} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Plan distribution</CardTitle>
            <CardDescription>Jumlah subscription per paket.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planCounts.map((row) => (
              <div key={row.plan} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold capitalize">{row.plan}</span>
                  <span className="text-muted-foreground">{row.count} total · {row.activeCount} active/trial</span>
                </div>
                <Progress value={(row.count / largestPlanCount) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Plan catalog</CardTitle>
            <CardDescription>Paket yang tersedia untuk administrasi subscription.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {planOrder.map((plan) => {
              const item = data.planCatalog[plan];
              return (
                <div key={plan} className="surface-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-semibold">{item.label}</div>
                    <Badge variant="secondary">{formatCurrency(item.monthlyCents)}/mo</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.focus}</p>
                  <p className="mt-3 text-xs font-semibold text-muted-foreground">{item.seats}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
