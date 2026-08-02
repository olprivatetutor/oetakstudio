import { BookOpen, Building2, FileText, Target } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { getPlatformConfiguration } from "@/lib/services/content-system";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function AdminTaxonomyPage() {
  const { user } = await requireAppOwnerPageUser();
  const config = await getPlatformConfiguration(user);
  return (
    <PageShell className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Platform configuration" title="Global taxonomy and library oversight" description="App Owner view for curriculum coverage, tenant curriculum inheritance, content tracks, and reusable assets." />
      <section className="grid gap-4 md:grid-cols-4"><MetricCard label="Tenants" value={config.organizations.length} icon={Building2} /><MetricCard label="Curricula" value={config.taxonomy.curricula.length} icon={BookOpen} tone="purple" /><MetricCard label="Objectives" value={config.taxonomy.learningObjectives.length} icon={Target} tone="gold" /><MetricCard label="Assets" value={config.assets.length} icon={FileText} tone="stone" /></section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Tenant curriculum posture</CardTitle><CardDescription>School tenants can inherit global curricula or use custom curriculum mode.</CardDescription></CardHeader><CardContent className="space-y-3">{config.organizations.map((org) => <div key={org.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{org.name}</div><Badge>{org.type}</Badge></div><div className="text-sm text-muted-foreground">{org.primaryContentTrack} · {org.curriculumMode}</div></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Track coverage</CardTitle><CardDescription>Active system tracks available to learner and content workflows.</CardDescription></CardHeader><CardContent className="space-y-3">{config.taxonomy.tracks.map((track) => <div key={track.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="font-semibold">{track.id} · {track.name}</div><div className="text-sm text-muted-foreground">{track.description}</div></div>)}</CardContent></Card>
      </section>
    </PageShell>
  );
}
