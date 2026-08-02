import Link from "next/link";
import { BookOpenCheck, FileText, Sparkles, UsersRound } from "lucide-react";
import { getPlatformContentStudio } from "@/lib/services/app-admin";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseStatusForm } from "@/components/content/course-status-form";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function ContentLibraryPage() {
  const { user } = await requireContentStudioPageUser();
  const data = await getPlatformContentStudio(user);

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Library" title="Global course inventory" description="Review every platform-wide course, open learner preview, and update publishing status." action={<Button asChild><Link href="/content/builder">New course</Link></Button>} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Courses" value={data.stats.totalCourses} icon={BookOpenCheck} />
        <MetricCard label="Published" value={data.stats.published} icon={Sparkles} tone="gold" />
        <MetricCard label="Modules" value={data.stats.modules} icon={FileText} tone="purple" />
        <MetricCard label="Enrollments" value={data.stats.enrollments} icon={UsersRound} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {data.courses.length === 0 ? (
          <Card className="border-dashed xl:col-span-2"><CardHeader><CardTitle>No global courses yet</CardTitle><CardDescription>Create the first Platform Content Library course from Builder.</CardDescription></CardHeader></Card>
        ) : data.courses.map((course) => (
          <Card key={course.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{course.title}</CardTitle>
                  <CardDescription>{course.category} · {course.level} · {course.moduleCount} modules · {course.estimatedMinutes} minutes</CardDescription>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                </div>
                <div className="flex flex-wrap gap-2"><Badge>{course.status}</Badge>{course.aiGenerated && <Badge variant="secondary">AI assisted</Badge>}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="surface-card p-3"><div className="text-lg font-semibold">{course.enrollmentCount}</div><div className="text-xs text-muted-foreground">Enrollments</div></div>
                <div className="surface-card p-3"><div className="text-lg font-semibold">{course.averageProgress}%</div><div className="text-xs text-muted-foreground">Avg progress</div></div>
                <div className="surface-card p-3"><div className="text-lg font-semibold">{course.certificateCount}</div><div className="text-xs text-muted-foreground">Certificates</div></div>
              </div>
              <CourseStatusForm courseId={course.id} status={course.status} />
              <Button asChild variant="outline" size="sm"><Link href={`/dashboard/courses/${course.id}`}>Preview course</Link></Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
