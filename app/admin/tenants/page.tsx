import { Building2, GraduationCap, Users, WalletCards } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { getAppAdminTenants } from "@/lib/services/app-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";
import { SubscriptionCard } from "@/components/admin/subscription-card";

function planLabel(value?: string | null) {
  return value ? value.replace("_", " ") : "No plan";
}

export default async function AdminTenantsPage() {
  const { user } = await requireAppOwnerPageUser();
  const tenants = await getAppAdminTenants(user);
  const activeTenants = tenants.filter((tenant) => tenant.status === "active" || tenant.status === "trialing").length;
  const members = tenants.reduce((sum, tenant) => sum + Number(tenant.memberCount ?? 0), 0);
  const courses = tenants.reduce((sum, tenant) => sum + Number(tenant.courseCount ?? 0), 0);

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Tenant operations"
        title="Tenant administration"
        description="Kelola workspace organisasi, status langganan, seats, dan catatan billing untuk setiap tenant dari App Owner console."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tenants" value={tenants.length} icon={Building2} />
        <MetricCard label="Active or trial" value={activeTenants} icon={WalletCards} tone="gold" />
        <MetricCard label="Members" value={members} icon={Users} tone="purple" />
        <MetricCard label="Courses" value={courses} icon={GraduationCap} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {tenants.map((tenant) => (
          tenant.subscriptionId && tenant.plan && tenant.status ? (
            <SubscriptionCard
              key={tenant.organizationId}
              id={tenant.subscriptionId}
              title={tenant.organizationName}
              description={`${tenant.organizationSlug} tenant subscription`}
              plan={tenant.plan}
              status={tenant.status}
              seats={tenant.seats ?? 1}
              billingEmail={tenant.billingEmail}
              currentPeriodEnd={tenant.currentPeriodEnd}
              notes={tenant.notes}
              meta={`${tenant.memberCount} members · ${tenant.courseCount} courses · workspace plan ${planLabel(tenant.organizationPlan)}`}
            />
          ) : (
            <Card key={tenant.organizationId} className="border-dashed">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{tenant.organizationName}</CardTitle>
                    <CardDescription>{tenant.organizationSlug} · {tenant.memberCount} members · {tenant.courseCount} courses</CardDescription>
                  </div>
                  <Badge variant="outline">No subscription row</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                Tenant ini belum memiliki record subscription. Tenant baru akan dibuatkan subscription otomatis; data lama bisa dimigrasikan lewat seed atau script maintenance.
              </CardContent>
            </Card>
          )
        ))}
      </section>
    </PageShell>
  );
}
