import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "@/components/learning/course-form";
import { AiCourseGenerator } from "@/components/content/ai-course-generator";
import { PageHeader, PageShell } from "@/components/premium/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ContentBuilderPage() {
  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Builder" title="Create global learner content" description="Create platform-wide courses for individual learners. These courses are not attached to a tenant organization." />
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit"><Sparkles className="h-3.5 w-3.5" />Platform Content Library</Badge>
          <CardTitle className="text-2xl">New global course</CardTitle>
          <CardDescription>Use draft for work in progress, then publish when the course is ready for learner enrollment.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="generate" className="w-full">
            <TabsList><TabsTrigger value="generate">Generate with AI</TabsTrigger><TabsTrigger value="manual">Build manually</TabsTrigger></TabsList>
            <TabsContent value="generate" className="pt-4"><AiCourseGenerator organizations={[]} allowPlatformCatalog /></TabsContent>
            <TabsContent value="manual" className="pt-4"><CourseForm organizations={[]} allowPlatformCatalog /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </PageShell>
  );
}
