import Link from "next/link";
import { BookOpen, Layers3, Target } from "lucide-react";
import { listTaxonomy } from "@/lib/services/content-system";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function TracksPage() {
  const taxonomy = await listTaxonomy();
  return (
    <PageShell>
      <PageHeader eyebrow="Track planner" title="Choose the right learning scope" description="Explore platform content tracks, system curricula, subjects, and learning objectives before starting a course or placement test." action={<Button asChild><Link href="/dashboard/placement"><Target className="h-4 w-4" />Start placement</Link></Button>} />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Tracks" value={taxonomy.tracks.length} icon={Layers3} />
        <MetricCard label="Curricula" value={taxonomy.curricula.length} icon={BookOpen} tone="purple" />
        <MetricCard label="Learning objectives" value={taxonomy.learningObjectives.length} icon={Target} tone="gold" />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {taxonomy.tracks.map((track) => (
          <Card key={track.id}>
            <CardHeader><Badge className="w-fit">{track.id}</Badge><CardTitle>{track.name}</CardTitle><CardDescription>{track.targetAudience}</CardDescription></CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">{track.description}</CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>System curricula</CardTitle><CardDescription>School organizations inherit these unless custom curriculum is configured.</CardDescription></CardHeader><CardContent className="grid gap-3">{taxonomy.curricula.map((item) => <div key={item.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="font-semibold">{item.code} · {item.name}</div><div className="text-sm text-muted-foreground">{item.characteristics}</div></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Learning objective sample</CardTitle><CardDescription>Used by scoped school placement tests.</CardDescription></CardHeader><CardContent className="grid gap-3">{taxonomy.learningObjectives.slice(0, 8).map((item) => <div key={item.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="font-semibold">{item.objectiveId}</div><div className="text-sm text-muted-foreground">{item.gradeLabel} · {item.subjectCode} · {item.objective}</div></div>)}</CardContent></Card>
      </section>
    </PageShell>
  );
}
