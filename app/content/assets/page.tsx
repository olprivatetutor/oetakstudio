import { FileText, PackageCheck, Sparkles } from "lucide-react";
import { requireContentStudioPageUser } from "@/app/content/content-context";
import { listContentAssets } from "@/lib/services/content-system";
import { AssetForm } from "@/components/content/asset-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function ContentAssetsPage() {
  const { user } = await requireContentStudioPageUser();
  const assets = await listContentAssets(user);
  const published = assets.filter((asset) => asset.status === "published").length;
  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Assets" title="Platform content assets" description="Manage reusable videos, documents, H5P templates, SCORM packages, and interactive materials." />
      <section className="grid gap-4 md:grid-cols-3"><MetricCard label="Assets" value={assets.length} icon={FileText} /><MetricCard label="Published" value={published} icon={PackageCheck} tone="gold" /><MetricCard label="Reusable templates" value={assets.filter((asset) => asset.kind === "template" || asset.kind === "h5p").length} icon={Sparkles} tone="purple" /></section>
      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card><CardHeader><CardTitle>Create asset</CardTitle><CardDescription>Register a reusable asset with validated metadata.</CardDescription></CardHeader><CardContent><AssetForm /></CardContent></Card>
        <Card><CardHeader><CardTitle>Asset inventory</CardTitle><CardDescription>Global assets visible to content operations.</CardDescription></CardHeader><CardContent className="space-y-3">{assets.length === 0 ? <p className="text-sm text-muted-foreground">No assets yet.</p> : assets.map((asset) => <div key={asset.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{asset.title}</div><div className="text-sm text-muted-foreground">{asset.description}</div></div><Badge>{asset.status}</Badge></div><div className="mt-2 text-xs text-muted-foreground">{asset.kind} · {asset.tags.join(", ")}</div></div>)}</CardContent></Card>
      </section>
    </PageShell>
  );
}
