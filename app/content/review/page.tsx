import Link from "next/link";
import { Archive, ClipboardCheck, FileClock, Sparkles } from "lucide-react";
import { getPlatformContentStudio } from "@/lib/services/app-admin";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseStatusForm } from "@/components/content/course-status-form";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function ContentReviewPage() {
  const { user } = await requireContentStudioPageUser();
  const data = await getPlatformContentStudio(user);
  const drafts = data.courses.filter((course) => course.status === "draft");
  const archived = data.courses.filter((course) => course.status === "archived");

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Review" title="Publishing review queue" description="Move global courses between draft, published, and archived states before learners see them." />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Draft" value={drafts.length} icon={FileClock} />
        <MetricCard label="Archived" value={archived.length} icon={Archive} tone="stone" />
        <MetricCard label="Published" value={data.stats.published} icon={Sparkles} tone="gold" />
      </section>

      <section className="space-y-4">
        <div><h2 className="text-2xl font-semibold tracking-normal">Needs decision</h2><p className="mt-1 text-sm text-muted-foreground">Draft and archived courses with quick status controls.</p></div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.reviewQueue.length === 0 ? (
            <Card className="border-dashed xl:col-span-2"><CardHeader><CardTitle>No review items</CardTitle><CardDescription>Every global course is currently published.</CardDescription></CardHeader></Card>
          ) : data.reviewQueue.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle className="text-xl">{course.title}</CardTitle><CardDescription>{course.category} · {course.level} · updated {new Date(course.updatedAt).toLocaleDateString()}</CardDescription></div>
                  <Badge variant="secondary"><ClipboardCheck className="h-3.5 w-3.5" />{course.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{course.description}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="surface-card p-3"><div className="text-lg font-semibold">{course.moduleCount}</div><div className="text-xs text-muted-foreground">Modules</div></div>
                  <div className="surface-card p-3"><div className="text-lg font-semibold">{course.estimatedMinutes}</div><div className="text-xs text-muted-foreground">Minutes</div></div>
                  <div className="surface-card p-3"><div className="text-lg font-semibold">{course.enrollmentCount}</div><div className="text-xs text-muted-foreground">Enrollments</div></div>
                </div>
                <CourseStatusForm courseId={course.id} status={course.status} />
                <Button asChild variant="outline" size="sm"><Link href={`/dashboard/courses/${course.id}`}>Preview</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
