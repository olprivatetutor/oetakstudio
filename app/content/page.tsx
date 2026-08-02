import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  PenLine,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { getPlatformContentStudio } from "@/lib/services/app-admin";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageShell } from "@/components/premium/page-shell";

function statusTone(status: string) {
  if (status === "published") return "default";
  if (status === "draft") return "secondary";
  return "outline";
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BookOpenCheck }) {
  return (
    <div className="rounded-[1.25rem] border bg-card/64 p-4 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="text-2xl font-semibold tracking-normal">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function ContentStudioPage() {
  const { user } = await requireContentStudioPageUser();
  const data = await getPlatformContentStudio(user);
  const publishedCoverage = data.stats.totalCourses > 0 ? Math.round((data.stats.published / data.stats.totalCourses) * 100) : 0;
  const pipeline = [
    { label: "Draft", value: data.stats.drafts, icon: PenLine, tone: "bg-secondary/12 text-secondary" },
    { label: "Review", value: data.reviewQueue.length, icon: ClipboardCheck, tone: "bg-[#d8bd72]/20 text-[#8a6532]" },
    { label: "Published", value: data.stats.published, icon: CheckCircle2, tone: "bg-primary/10 text-primary" },
    { label: "Archived", value: data.stats.archived, icon: Archive, tone: "bg-muted text-muted-foreground" },
  ];

  return (
    <PageShell className="w-full p-0">
      <section className="rounded-[2rem] border bg-card/76 p-5 shadow-[var(--shadow-card)] backdrop-blur-xl md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary"><Sparkles className="h-3.5 w-3.5" />Content Manager</Badge>
              <Badge variant="outline">Platform Content Library</Badge>
            </div>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-normal md:text-5xl">Global learner content workspace</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">Create, publish, and monitor the platform-wide course catalog used by individual learners.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link href="/content/builder"><PenLine className="h-4 w-4" />Create course</Link></Button>
            <Button asChild variant="outline"><Link href="/content/review">Review queue<ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Global courses" value={data.stats.totalCourses} icon={BookOpenCheck} />
          <StatTile label="Learner enrollments" value={data.stats.enrollments} icon={UsersRound} />
          <StatTile label="Learning minutes" value={data.stats.minutes} icon={Clock3} />
          <StatTile label="Certificates issued" value={data.stats.certificatesIssued} icon={Award} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl">Publishing pipeline</CardTitle>
            <CardDescription>Current state of the global catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="font-semibold">Published coverage</span><span className="text-muted-foreground">{publishedCoverage}%</span></div>
              <Progress value={publishedCoverage} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pipeline.map((item) => (
                <div key={item.label} className="rounded-[1.25rem] border bg-card/54 p-4">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}><item.icon className="h-5 w-5" /></div>
                  <div className="text-2xl font-semibold">{item.value}</div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Work queue</CardTitle>
                <CardDescription>Draft and archived courses waiting for a publishing decision.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/content/review">Review all</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.reviewQueue.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed bg-muted/45 p-5 text-sm text-muted-foreground">No draft or archived courses need review.</div>
            ) : data.reviewQueue.slice(0, 5).map((course) => (
              <Link key={course.id} href="/content/review" className="block rounded-[1.25rem] border bg-card/54 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{course.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{course.category} · {course.moduleCount} modules · {course.estimatedMinutes} min</div>
                  </div>
                  <Badge variant={statusTone(course.status)}>{course.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Course performance</CardTitle>
                <CardDescription>Global courses ranked by learner activity.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/content/analytics">Analytics</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topCourses.length === 0 ? <p className="text-sm text-muted-foreground">No course engagement yet.</p> : data.topCourses.slice(0, 6).map((course, index) => (
              <div key={course.id} className="grid gap-3 rounded-[1.25rem] border bg-card/54 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-sm font-semibold">{index + 1}</div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{course.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{course.averageProgress}% average progress · {course.completionCount} completions</div>
                </div>
                <Badge variant="secondary">{course.enrollmentCount} enrollments</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Category mix</CardTitle>
            <CardDescription>Coverage across learning topics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.categories.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet.</p> : data.categories.slice(0, 6).map((row) => (
              <div key={row.category} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{row.category}</span><span className="text-muted-foreground">{row.courses} courses</span></div>
                <Progress value={data.stats.totalCourses > 0 ? Math.round((row.courses / data.stats.totalCourses) * 100) : 0} />
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />{row.minutes} minutes · {row.enrollments} enrollments</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
