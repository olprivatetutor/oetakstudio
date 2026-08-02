import { Activity, Building2, Clock3, UserRound } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { getAppAdminActivity } from "@/lib/services/app-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

function formatDate(value?: Date | string | null) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString();
}

export default async function AdminActivityPage() {
  const { user } = await requireAppOwnerPageUser();
  const activity = await getAppAdminActivity(user);
  const tenantEvents = activity.filter((row) => row.organizationId).length;
  const actorEvents = activity.filter((row) => row.actorUserId).length;

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Audit trail"
        title="Platform activity"
        description="Lihat aktivitas terbaru lintas tenant dan user untuk kebutuhan support, review operasional, dan investigasi owner-level."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recent events" value={activity.length} icon={Activity} />
        <MetricCard label="Tenant scoped" value={tenantEvents} icon={Building2} tone="purple" />
        <MetricCard label="Actor linked" value={actorEvents} icon={UserRound} tone="gold" />
        <MetricCard label="Window" value="Latest 30" icon={Clock3} tone="stone" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Audit log</CardTitle>
          <CardDescription>Event terbaru dari tabel audit platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.length === 0 ? (
            <p className="rounded-[1.25rem] border border-dashed bg-muted/45 p-5 text-sm text-muted-foreground">Belum ada audit activity.</p>
          ) : activity.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-[1.25rem] border bg-card/54 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.action}</span>
                  <Badge variant="secondary">{row.entityType}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {row.actorName ?? row.actorEmail ?? "System"} · {row.organizationName ?? "No tenant"} · {row.entityId ?? "No entity id"}
                </div>
              </div>
              <div className="text-sm font-medium text-muted-foreground">{formatDate(row.createdAt)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
