import { requireUser } from "@/lib/api/session";
import { listPlacementTests } from "@/lib/services/content-system";
import { PlacementTestForm } from "@/components/learning/placement-test-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function PlacementPage() {
  const user = await requireUser();
  const tests = await listPlacementTests(user);
  return (
    <PageShell>
      <PageHeader eyebrow="Placement" title="Adaptive placement tests" description="Run scope-locked school placement or open proficiency placement depending on your selected track." />
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <PlacementTestForm />
        <Card><CardHeader><CardTitle className="text-2xl">Recent results</CardTitle><CardDescription>Your last placement attempts and recommendations.</CardDescription></CardHeader><CardContent className="space-y-3">{tests.length === 0 ? <p className="text-sm text-muted-foreground">No placement tests yet.</p> : tests.map((test) => <div key={test.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{test.track} · {test.subjectCode || test.skillFramework}</div><Badge>{test.status}</Badge></div><div className="mt-1 text-sm text-muted-foreground">{test.scope} · {test.score ?? 0}% · {test.recommendedLevel ?? "pending"}</div></div>)}</CardContent></Card>
      </section>
    </PageShell>
  );
}
