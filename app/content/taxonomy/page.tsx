import { BookOpen, ListChecks, Target } from "lucide-react";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { listTaxonomy } from "@/lib/services/content-system";
import { CurriculumForm, LearningObjectiveForm } from "@/components/content/taxonomy-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function ContentTaxonomyPage() {
  await requireContentStudioPageUser();
  const taxonomy = await listTaxonomy();
  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Taxonomy" title="Curriculum and objective management" description="Maintain the global content taxonomy used by school curriculum courses and scoped placement tests." />
      <section className="grid gap-4 md:grid-cols-3"><MetricCard label="Tracks" value={taxonomy.tracks.length} icon={ListChecks} /><MetricCard label="Curricula" value={taxonomy.curricula.length} icon={BookOpen} tone="purple" /><MetricCard label="Objectives" value={taxonomy.learningObjectives.length} icon={Target} tone="gold" /></section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Create curriculum</CardTitle><CardDescription>Add a global curriculum option for schools and individual learners.</CardDescription></CardHeader><CardContent><CurriculumForm /></CardContent></Card>
        <Card><CardHeader><CardTitle>Create learning objective</CardTitle><CardDescription>Add objective-level scope for placement and curriculum mapping.</CardDescription></CardHeader><CardContent><LearningObjectiveForm /></CardContent></Card>
      </section>
      <Card><CardHeader><CardTitle>Learning objective registry</CardTitle><CardDescription>Active global learning objectives.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{taxonomy.learningObjectives.map((item) => <div key={item.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex flex-wrap gap-2"><Badge>{item.curriculumCode}</Badge><Badge variant="secondary">{item.gradeLabel}</Badge><Badge variant="outline">{item.subjectCode}</Badge></div><div className="mt-2 font-semibold">{item.objectiveId}</div><div className="text-sm text-muted-foreground">{item.objective}</div></div>)}</CardContent></Card>
    </PageShell>
  );
}
