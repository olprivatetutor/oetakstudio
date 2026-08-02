import { Award, BarChart3, FileCheck2, TrendingUp, UsersRound } from "lucide-react";
import { getPlatformContentStudio } from "@/lib/services/app-admin";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function ContentAnalyticsPage() {
  const { user } = await requireContentStudioPageUser();
  const data = await getPlatformContentStudio(user);
  const maxEnrollments = Math.max(...data.topCourses.map((course) => Number(course.enrollmentCount ?? 0)), 1);

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Analytics" title="Global content performance" description="Track learner engagement across Platform Content Library courses." />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enrollments" value={data.stats.enrollments} icon={UsersRound} />
        <MetricCard label="Completion rate" value={`${data.stats.completionRate}%`} icon={TrendingUp} tone="gold" />
        <MetricCard label="Submissions" value={data.stats.submissions} icon={FileCheck2} tone="purple" />
        <MetricCard label="Certificates" value={data.stats.certificatesIssued} icon={Award} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-2xl">Course engagement</CardTitle><CardDescription>Enrollment share and completion progress by course.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {data.topCourses.length === 0 ? <p className="text-sm text-muted-foreground">No engagement yet.</p> : data.topCourses.map((course) => (
              <div key={course.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="font-semibold">{course.title}</span><span className="text-muted-foreground">{course.enrollmentCount} enrollments · {course.averageProgress}% avg</span></div>
                <Progress value={(Number(course.enrollmentCount ?? 0) / maxEnrollments) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-2xl">Category demand</CardTitle><CardDescription>Topic areas ranked by learner activity.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {data.categories.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet.</p> : data.categories.map((row) => (
              <div key={row.category} className="rounded-[1.25rem] border bg-card/54 p-4">
                <div className="flex items-center justify-between gap-3"><div className="font-semibold">{row.category}</div><Badge variant="secondary">{row.enrollments} enrollments</Badge></div>
                <div className="mt-2 text-sm text-muted-foreground">{row.courses} courses · {row.minutes} learning minutes</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-2xl"><BarChart3 className="h-5 w-5 text-primary" />Status mix</CardTitle><CardDescription>Publishing state across the global catalog.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="surface-card p-4"><div className="text-2xl font-semibold">{data.stats.drafts}</div><div className="text-sm text-muted-foreground">Draft courses</div></div>
          <div className="surface-card p-4"><div className="text-2xl font-semibold">{data.stats.published}</div><div className="text-sm text-muted-foreground">Published courses</div></div>
          <div className="surface-card p-4"><div className="text-2xl font-semibold">{data.stats.archived}</div><div className="text-sm text-muted-foreground">Archived courses</div></div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
