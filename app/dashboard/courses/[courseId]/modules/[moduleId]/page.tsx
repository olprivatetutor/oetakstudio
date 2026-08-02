import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getCourseModuleDetail } from "@/lib/services/learning";
import { Button } from "@/components/ui/button";
import { AiTutorPanel } from "@/components/learning/ai-tutor-panel";
import { ModuleLearningWorkspace } from "@/components/learning/module-learning-workspace";
import { PageShell } from "@/components/premium/page-shell";

export default async function CourseModulePage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const user = await requireUser();
  const { courseId, moduleId } = await params;
  const detail = await getCourseModuleDetail(user, courseId, moduleId);

  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit">
        <Link href={`/dashboard/courses/${detail.course.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>
      </Button>

      <ModuleLearningWorkspace
        course={{
          id: detail.course.id,
          title: detail.course.title,
          curriculumCode: detail.course.curriculumCode,
          gradeLabel: detail.course.gradeLabel,
          subjectCode: detail.course.subjectCode,
        }}
        module={{
          id: detail.module.id,
          courseId: detail.module.courseId,
          title: detail.module.title,
          summary: detail.module.summary,
          position: detail.module.position,
          type: detail.module.type,
          content: detail.module.content,
          estimatedMinutes: detail.module.estimatedMinutes,
        }}
        modules={detail.modules.map((item) => ({
          id: item.id,
          courseId: item.courseId,
          title: item.title,
          summary: item.summary,
          position: item.position,
          type: item.type,
          content: item.content,
          estimatedMinutes: item.estimatedMinutes,
        }))}
        assets={detail.assets.map((asset) => ({
          id: asset.id,
          title: asset.title,
          description: asset.description,
          kind: asset.kind,
          tags: asset.tags,
        }))}
        enrollmentId={detail.enrollment?.id}
        initialStatus={detail.currentProgress?.status ?? "not_started"}
        nextModuleId={detail.nextModule?.id}
        previousModuleId={detail.previousModule?.id}
      />

      <AiTutorPanel courseId={detail.course.id} moduleId={detail.module.id} />
    </PageShell>
  );
}
