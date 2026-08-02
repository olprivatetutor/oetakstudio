import { BookOpenCheck, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function ContentSettingsPage() {
  const { admin } = await requireContentStudioPageUser();

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Settings" title="Content Studio settings" description="Operational boundaries for global learner content and Content Manager access." />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Platform role" value={admin.role} icon={ShieldCheck} />
        <MetricCard label="Access status" value={admin.status} icon={LockKeyhole} tone="purple" />
        <MetricCard label="Catalog scope" value="Global" icon={BookOpenCheck} tone="gold" />
        <MetricCard label="Guard" value="Server" icon={KeyRound} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Role boundary</CardTitle><Badge>Active</Badge></div><CardDescription>Content Manager can access `/content`, not `/admin`.</CardDescription></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">Content role focuses on global learning material and does not include subscription, tenant billing, or App Owner operational controls.</CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Global catalog</CardTitle><Badge variant="secondary">organizationId null</Badge></div><CardDescription>Content Studio writes platform-wide courses only.</CardDescription></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">Courses created here are stored without a tenant organization and can appear in the learner catalog when published.</CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Tenant separation</CardTitle><Badge variant="outline">Protected</Badge></div><CardDescription>Tenant course creation remains in Tenant Builder.</CardDescription></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">Organization owner, Organization manager, and Teacher roles manage tenant courses through dashboard builder, not Content Studio.</CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
