import Link from "next/link";
import { ArrowLeft, Clock, FileText, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getCourseDetail } from "@/lib/services/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EnrollButton } from "@/components/learning/enroll-button";
import { ModuleProgressButton } from "@/components/learning/module-progress-button";
import { AiTutorPanel } from "@/components/learning/ai-tutor-panel";
import { AssessmentForm } from "@/components/learning/assessment-form";
import { CertificateButton } from "@/components/learning/certificate-button";
import { PageShell } from "@/components/premium/page-shell";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await requireUser();
  const { courseId } = await params;
  const detail = await getCourseDetail(user, courseId);
  const progressByModule = new Map(detail.progress.map((row) => [row.moduleId, row.status]));
  const progress = detail.enrollment?.progress ?? 0;

  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit"><Link href="/dashboard/courses"><ArrowLeft className="h-4 w-4" />Catalog</Link></Button>
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap gap-2"><Badge>{detail.course.category}</Badge><Badge variant="outline">{detail.course.level}</Badge><Badge variant="secondary">{detail.course.status}</Badge></div>
            <CardTitle className="max-w-4xl text-3xl md:text-4xl">{detail.course.title}</CardTitle>
            <CardDescription className="max-w-3xl text-base">{detail.course.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground"><span className="soft-status"><Clock className="h-4 w-4" />{detail.course.estimatedMinutes} minutes</span><span className="soft-status">{detail.modules.length} modules</span><span className="soft-status">{detail.assessments.length} assessments</span></div>
            <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="font-medium">Course progress</span><span>{progress}%</span></div><Progress value={progress} /></div>
            <div className="flex flex-wrap gap-3"><EnrollButton courseId={detail.course.id} enrolled={Boolean(detail.enrollment)} /><CertificateButton enrollmentId={detail.enrollment?.id} progress={progress} /></div>
          </CardContent>
        </Card>
        <AiTutorPanel courseId={detail.course.id} moduleId={detail.modules[0]?.id} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle className="text-2xl">Learning modules</CardTitle><CardDescription>Progress is saved per enrollment and cannot be updated for another user.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {detail.modules.map((module) => (
              <div key={module.id} className="grid gap-4 rounded-[1.25rem] border bg-card/54 p-4 transition-all duration-200 hover:shadow-[var(--shadow-soft)] md:grid-cols-[1fr_auto]">
                <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{module.position}</Badge><h3 className="font-semibold">{module.title}</h3><Badge variant="secondary">{module.type}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{module.summary}</p><div className="flex items-center gap-1 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />{module.estimatedMinutes} minutes</div></div>
                <ModuleProgressButton moduleId={module.id} enrollmentId={detail.enrollment?.id} initialStatus={progressByModule.get(module.id) ?? "not_started"} moduleHref={`/dashboard/courses/${detail.course.id}/modules/${module.id}`} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><Badge variant="secondary" className="w-fit"><Sparkles className="h-3.5 w-3.5" />AI-modeled feedback</Badge><CardTitle className="text-2xl">Assessment</CardTitle><CardDescription>Objective and essay-style submissions receive immediate feedback.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {detail.assessments.length === 0 ? <p className="rounded-[1.5rem] border border-dashed bg-muted/45 p-5 text-sm text-muted-foreground">No assessment configured for this course.</p> : detail.assessments.map((assessment) => (
              <div key={assessment.id} className="space-y-3 rounded-[1.25rem] border bg-card/54 p-4"><div><div className="font-semibold">{assessment.title}</div>{assessment.questions.length === 0 && <p className="text-sm leading-6 text-muted-foreground">{assessment.prompt}</p>}</div><AssessmentForm assessmentId={assessment.id} enrollmentId={detail.enrollment?.id} questions={assessment.questions} /></div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
