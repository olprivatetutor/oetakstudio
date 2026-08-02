import Link from "next/link";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getDashboardData } from "@/lib/services/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function LearningPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);

  return (
    <PageShell>
      <PageHeader eyebrow="My learning" title="Your enrolled learning paths" description="All enrollments, progress states, and next actions for your account." />
      {data.enrollments.length === 0 ? (
        <EmptyState title="No courses enrolled yet" description="Browse the catalog and start with a course that matches your current goal." action={<Button asChild><Link href="/dashboard/courses">Browse catalog</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.enrollments.map((enrollment) => (
            <Card key={enrollment.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between gap-3"><Badge variant={enrollment.status === "completed" ? "default" : "secondary"}>{enrollment.status}</Badge><span className="soft-status">{enrollment.progress}%</span></div>
                <CardTitle className="text-2xl">{enrollment.title}</CardTitle>
                <CardDescription>{enrollment.category} · {enrollment.level}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Progress value={enrollment.progress} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="surface-card p-3"><BookOpen className="mb-2 h-4 w-4 text-primary" />Continue modules</div>
                  <div className="surface-card p-3"><CheckCircle2 className="mb-2 h-4 w-4 text-primary" />Save progress</div>
                </div>
                <Button asChild className="w-full"><Link href={`/dashboard/courses/${enrollment.courseId}`}>Continue</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
