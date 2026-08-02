import { Activity, BarChart3, Building2 } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getDashboardData, getOrganizationDashboard } from "@/lib/services/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const [dashboard, organization] = await Promise.all([getDashboardData(user), getOrganizationDashboard(user)]);
  const completionRate = dashboard.enrollments.length ? Math.round((dashboard.stats.completedCourses / dashboard.enrollments.length) * 100) : 0;
  const orgAverageProgress = organization.enrollments.length ? Math.round(organization.enrollments.reduce((sum, row) => sum + row.progress, 0) / organization.enrollments.length) : 0;

  return (
    <PageShell>
      <PageHeader eyebrow="Analytics" title="Learning performance at a glance" description="Personal learning analytics and tenant-level progress for memberships you can access." />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Personal average" value={`${dashboard.stats.averageProgress}%`} icon={Activity} description="Average progress across your enrollments." />
        <MetricCard label="Completion rate" value={`${completionRate}%`} icon={BarChart3} tone="purple" description="Completed courses compared to active enrollment history." />
        <MetricCard label="Organization average" value={`${orgAverageProgress}%`} icon={Building2} tone="gold" description="Average enrollment progress across accessible organizations." />
      </section>
      <Card>
        <CardHeader><CardTitle className="text-2xl">Course progress breakdown</CardTitle><CardDescription>Data is calculated from enrollments owned by your user.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {dashboard.enrollments.length === 0 ? <p className="rounded-[1.5rem] border border-dashed bg-muted/45 p-6 text-sm text-muted-foreground">No personal analytics available yet.</p> : dashboard.enrollments.map((row) => (
            <div key={row.id} className="rounded-[1.25rem] border bg-card/52 p-4">
              <div className="mb-3 flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{row.title}</span><span className="soft-status">{row.progress}%</span></div>
              <Progress value={row.progress} />
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
