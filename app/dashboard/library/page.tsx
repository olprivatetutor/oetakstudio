import { requireUser } from "@/lib/api/session";
import { listContentAssets, listPersonalLibrary } from "@/lib/services/content-system";
import { LibrarySaveButton } from "@/components/learning/library-save-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function LibraryPage() {
  const user = await requireUser();
  const [library, assets] = await Promise.all([listPersonalLibrary(user), listContentAssets(user)]);
  return (
    <PageShell>
      <PageHeader eyebrow="Personal library" title="Saved content and platform assets" description="Save reusable assets, templates, and course references for your learning workflow." />
      <section className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Saved items</CardTitle><CardDescription>Your personal bookmarks and notes.</CardDescription></CardHeader><CardContent className="space-y-3">{library.length === 0 ? <p className="text-sm text-muted-foreground">No saved items yet.</p> : library.map((item) => <div key={item.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="font-semibold">{item.courseTitle || item.assetTitle}</div><div className="text-sm text-muted-foreground">{item.notes || "Saved for later review"}</div></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Available assets</CardTitle><CardDescription>Accessible global and tenant content library assets.</CardDescription></CardHeader><CardContent className="space-y-3">{assets.map((asset) => <div key={asset.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{asset.title}</div><div className="text-sm text-muted-foreground">{asset.description}</div></div><Badge>{asset.kind}</Badge></div><div className="mt-3"><LibrarySaveButton assetId={asset.id} /></div></div>)}</CardContent></Card>
      </section>
    </PageShell>
  );
}
