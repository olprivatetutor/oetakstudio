import Link from "next/link";
import { Activity, Building2, CircleDollarSign, CreditCard, FileCheck2, UserRound } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { formatCurrency, getAppAdminOverview } from "@/lib/services/app-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString();
}

export default async function AdminPage() {
  const { user } = await requireAppOwnerPageUser();
  const data = await getAppAdminOverview(user);
  const attentionItems = data.tenantSubscriptions.filter((row) => row.status === "trialing" || row.status === "past_due").slice(0, 4);

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="App owner console"
        title="Operate the Oetak SaaS business"
        description="Monitor tenants, learner accounts, subscription health, billing state, and platform activity from one owner-level workspace."
        action={<Button asChild><Link href="/admin/subscriptions">Manage subscriptions</Link></Button>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tenants" value={data.stats.tenants} icon={Building2} />
        <MetricCard label="Learner profiles" value={data.stats.learners} icon={UserRound} tone="purple" />
        <MetricCard label="Subscriptions" value={data.stats.activeSubscriptions + data.stats.trialSubscriptions} icon={CreditCard} tone="gold" />
        <MetricCard label="Estimated MRR" value={formatCurrency(data.stats.monthlyRecurringCents)} icon={CircleDollarSign} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Subscription attention</CardTitle>
            <CardDescription>Trials and billing states that need owner review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionItems.length === 0 ? (
              <p className="rounded-[1.25rem] border border-dashed bg-muted/45 p-5 text-sm text-muted-foreground">No subscriptions need attention right now.</p>
            ) : attentionItems.map((row) => (
              <div key={row.organizationId} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border bg-card/54 p-4">
                <div>
                  <div className="font-semibold">{row.organizationName}</div>
                  <div className="text-sm text-muted-foreground">{row.organizationSlug} · {row.memberCount} members</div>
                </div>
                <div className="flex gap-2"><Badge>{row.plan ?? "free"}</Badge><Badge variant="secondary">{row.status ?? "trialing"}</Badge></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Platform usage</CardTitle>
            <CardDescription>Operational signals across all accounts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="surface-card p-4"><Activity className="mb-3 h-5 w-5 text-primary" /><div className="text-2xl font-semibold">{data.stats.enrollments}</div><div className="text-sm text-muted-foreground">Enrollments</div></div>
            <div className="surface-card p-4"><FileCheck2 className="mb-3 h-5 w-5 text-primary" /><div className="text-2xl font-semibold">{data.stats.certificates}</div><div className="text-sm text-muted-foreground">Certificates</div></div>
            <div className="surface-card p-4"><CreditCard className="mb-3 h-5 w-5 text-primary" /><div className="text-2xl font-semibold">{data.stats.submissions}</div><div className="text-sm text-muted-foreground">Submissions</div></div>
            <div className="surface-card p-4"><Activity className="mb-3 h-5 w-5 text-primary" /><div className="text-2xl font-semibold">{data.usage.aiConversations}</div><div className="text-sm text-muted-foreground">AI conversations</div></div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent tenants</CardTitle><CardDescription>Newest tenant workspaces in the platform.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {data.tenantSubscriptions.slice(0, 5).map((row) => (
              <div key={row.organizationId} className="flex items-center justify-between gap-3 rounded-[1.25rem] border bg-card/54 p-4">
                <div><div className="font-semibold">{row.organizationName}</div><div className="text-sm text-muted-foreground">{row.memberCount} members · {row.courseCount} courses</div></div>
                <Badge variant="secondary">{row.status ?? "trialing"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Latest auditable platform actions.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : data.recentActivity.slice(0, 5).map((row) => (
              <div key={row.id} className="rounded-[1.25rem] border bg-card/54 p-4">
                <div className="font-semibold">{row.action}</div>
                <div className="text-sm text-muted-foreground">{row.entityType} · {row.organizationName ?? "No tenant"} · {formatDate(row.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
