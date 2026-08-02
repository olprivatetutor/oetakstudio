import Link from "next/link";
import { Building2, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getUserContext } from "@/lib/services/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseForm } from "@/components/learning/course-form";
import { AiCourseGenerator } from "@/components/content/ai-course-generator";
import { PageHeader, PageShell } from "@/components/premium/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function BuilderPage() {
  const user = await requireUser();
  const context = await getUserContext(user);
  const manageableOrganizations = context.memberships.filter((membership) => ["owner", "admin", "content", "teacher"].includes(membership.role));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Organization course builder"
        title="Create tenant learning paths"
        description="Build courses only for organizations where you have owner, organization manager, or teacher access. Platform-wide learner content is managed separately in Content Studio."
      />
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit"><Sparkles className="h-3.5 w-3.5" />Tenant curriculum studio</Badge>
          <CardTitle className="text-2xl">New organization course</CardTitle>
          <CardDescription>Courses created here are scoped to a tenant organization and will not appear in the global learner catalog.</CardDescription>
        </CardHeader>
        <CardContent>
          {manageableOrganizations.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed bg-muted/45 p-5 text-sm leading-6 text-muted-foreground">
              <Building2 className="mb-3 h-5 w-5 text-primary" />
              You do not manage any organization yet. Create or join an organization as owner, organization manager, or teacher before creating tenant courses.
              <div className="mt-4"><Button asChild variant="outline"><Link href="/dashboard/organization">Open organization</Link></Button></div>
            </div>
          ) : (
            <Tabs defaultValue="generate" className="w-full">
              <TabsList><TabsTrigger value="generate">Generate with AI</TabsTrigger><TabsTrigger value="manual">Build manually</TabsTrigger></TabsList>
              <TabsContent value="generate" className="pt-4"><AiCourseGenerator organizations={manageableOrganizations} /></TabsContent>
              <TabsContent value="manual" className="pt-4"><CourseForm organizations={manageableOrganizations} /></TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
