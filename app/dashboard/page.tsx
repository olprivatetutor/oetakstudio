import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award, BookOpen, Building2, ChartNoAxesCombined, Flame, GraduationCap, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getDashboardData } from "@/lib/services/learning";
import { getAppAdmin } from "@/lib/services/app-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { OnboardingForm } from "@/components/learning/onboarding-form";
import { formatOrganizationRole } from "@/lib/role-labels";
import { CourseCard, MetricCard, PageHeader, PageShell, ProgressFeatureCard } from "@/components/premium/page-shell";

export default async function DashboardPage() {
  const user = await requireUser();
  const appAdmin = await getAppAdmin(user.id);

  if (appAdmin && ["owner", "admin"].includes(appAdmin.role)) {
    redirect("/admin");
  }

  if (appAdmin && appAdmin.role === "content") {
    redirect("/content");
  }

  const data = await getDashboardData(user);
  const needsOnboarding = data.context.profile.goals.length === 0 && data.context.profile.interests.length === 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Learning command center"
        title={`Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Track progress, continue enrollments, and keep your organization learning context in view."
        action={<Button asChild><Link href="/dashboard/courses">Explore catalog<ArrowRight className="h-4 w-4" /></Link></Button>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active courses" value={data.stats.activeCourses} icon={BookOpen} description="Courses currently attached to your account." />
        <MetricCard label="Completed" value={data.stats.completedCourses} icon={GraduationCap} tone="purple" description="Finished learning paths across your workspace." />
        <MetricCard label="Average progress" value={`${data.stats.averageProgress}%`} icon={ChartNoAxesCombined} tone="gold" description="Your weighted personal completion rate." />
        <MetricCard label="Certificates" value={data.stats.certificates} icon={Award} tone="stone" description="Credentials ready for sharing." />
      </section>

      {needsOnboarding && (
        <Card className="overflow-hidden">
          <CardHeader>
            <Badge variant="secondary" className="w-fit"><Sparkles className="h-3.5 w-3.5" />Premium onboarding</Badge>
            <CardTitle className="text-2xl">Personalize your learning path</CardTitle>
            <CardDescription>Set goals and organization context so recommendations, analytics, and tutor prompts are grounded in your needs.</CardDescription>
          </CardHeader>
          <CardContent><OnboardingForm /></CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div><CardTitle className="text-2xl">Current learning</CardTitle><CardDescription>Continue the courses already attached to your account.</CardDescription></div>
            <Button asChild variant="outline" size="sm"><Link href="/dashboard/learning">View all<ArrowRight className="h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.enrollments.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed bg-muted/45 p-6 text-sm text-muted-foreground">No enrollments yet. Browse the catalog to start a course.</div>
            ) : data.enrollments.slice(0, 4).map((enrollment) => (
              <Link key={enrollment.id} href={`/dashboard/courses/${enrollment.courseId}`} className="block rounded-[1.25rem] border bg-card/56 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">{enrollment.title}</div><div className="text-sm text-muted-foreground">{enrollment.category} · {enrollment.level}</div></div><Badge variant={enrollment.status === "completed" ? "default" : "secondary"}>{enrollment.status}</Badge></div>
                <Progress value={enrollment.progress} className="mt-4" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ProgressFeatureCard title="Daily momentum" description="A lightweight XP-style view for keeping learning habits visible." value={Math.max(data.stats.averageProgress, 12)} badge="Learning streak" />
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Flame className="h-5 w-5 text-[#bd7b41]" />Motivation</CardTitle><CardDescription>Small, steady progress compounds across courses.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-muted/60 p-3"><div className="text-xl font-semibold">7</div><div className="text-xs text-muted-foreground">days</div></div>
              <div className="rounded-2xl bg-muted/60 p-3"><div className="text-xl font-semibold">+80</div><div className="text-xs text-muted-foreground">XP</div></div>
              <div className="rounded-2xl bg-muted/60 p-3"><div className="text-xl font-semibold">3</div><div className="text-xs text-muted-foreground">goals</div></div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Tenant context</CardTitle><CardDescription>Organizations and roles available to this user.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {data.context.memberships.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed bg-muted/45 p-5 text-sm text-muted-foreground">You are working as an individual learner.</div>
            ) : data.context.memberships.map((membership) => (
              <div key={membership.organizationId} className="flex items-center justify-between rounded-[1.25rem] border bg-card/58 p-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><span className="font-medium">{membership.name}</span></div><Badge>{formatOrganizationRole(membership.role)}</Badge></div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Recommended courses</h2><Button asChild variant="outline" size="sm"><Link href="/dashboard/courses">Open catalog</Link></Button></div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.recommended.slice(0, 4).map((course) => (
              <CourseCard key={course.id} href={`/dashboard/courses/${course.id}`} title={course.title} description={course.description} category={course.category} level={course.level} minutes={course.estimatedMinutes} />
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
