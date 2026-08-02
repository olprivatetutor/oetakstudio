import { CreditCard, Landmark, UsersRound, WalletCards } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { getAppAdminSubscriptions } from "@/lib/services/app-admin";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";
import { SubscriptionCard } from "@/components/admin/subscription-card";

export default async function AdminSubscriptionsPage() {
  const { user } = await requireAppOwnerPageUser();
  const { tenantSubscriptions, individualSubscriptions } = await getAppAdminSubscriptions(user);
  const tenantRows = tenantSubscriptions.filter((row) => row.subscriptionId && row.plan && row.status);
  const individualRows = individualSubscriptions.filter((row) => row.subscriptionId && row.plan && row.status);
  const activeRows = [...tenantRows, ...individualRows].filter((row) => row.status === "active" || row.status === "trialing");
  const pastDueRows = [...tenantRows, ...individualRows].filter((row) => row.status === "past_due");

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Subscription center"
        title="Subscriptions"
        description="Kelola paket, status billing, seats, tanggal renewal, email billing, dan catatan internal untuk tenant maupun learner individu."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tenant subscriptions" value={tenantRows.length} icon={Landmark} />
        <MetricCard label="Individual subscriptions" value={individualRows.length} icon={UsersRound} tone="purple" />
        <MetricCard label="Active or trial" value={activeRows.length} icon={WalletCards} tone="gold" />
        <MetricCard label="Past due" value={pastDueRows.length} icon={CreditCard} tone="stone" />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Tenant subscriptions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Organization-level billing records.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {tenantRows.length === 0 ? (
            <Card className="border-dashed xl:col-span-2"><CardHeader><CardTitle>No tenant subscriptions</CardTitle><CardDescription>Belum ada subscription tenant.</CardDescription></CardHeader></Card>
          ) : tenantRows.map((tenant) => (
            <SubscriptionCard
              key={tenant.subscriptionId}
              id={tenant.subscriptionId!}
              title={tenant.organizationName}
              description={`${tenant.organizationSlug} tenant subscription`}
              plan={tenant.plan!}
              status={tenant.status!}
              seats={tenant.seats ?? 1}
              billingEmail={tenant.billingEmail}
              currentPeriodEnd={tenant.currentPeriodEnd}
              notes={tenant.notes}
              meta={`${tenant.memberCount} members · ${tenant.courseCount} courses`}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Individual subscriptions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Personal learner billing records.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {individualRows.length === 0 ? (
            <Card className="border-dashed xl:col-span-2"><CardHeader><CardTitle>No individual subscriptions</CardTitle><CardDescription>Belum ada subscription learner individu.</CardDescription></CardHeader></Card>
          ) : individualRows.map((learner) => (
            <SubscriptionCard
              key={learner.subscriptionId}
              id={learner.subscriptionId!}
              title={learner.name ?? learner.email}
              description={learner.email}
              plan={learner.plan!}
              status={learner.status!}
              seats={learner.seats ?? 1}
              billingEmail={learner.billingEmail}
              currentPeriodEnd={learner.currentPeriodEnd}
              notes={learner.notes}
              meta={`${learner.enrollmentCount} enrollments · ${learner.certificateCount} certificates`}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
