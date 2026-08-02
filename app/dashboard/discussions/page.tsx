import { requireUser } from "@/lib/api/session";
import { listDiscussions } from "@/lib/services/content-system";
import { DiscussionForm } from "@/components/learning/discussion-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function DiscussionsPage() {
  const user = await requireUser();
  const discussions = await listDiscussions(user);
  return (
    <PageShell>
      <PageHeader eyebrow="Communication" title="Learning discussions" description="Create private, course, or organization discussions with tenant-aware access control." />
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card><CardHeader><CardTitle>New discussion</CardTitle><CardDescription>Create a private learning support thread.</CardDescription></CardHeader><CardContent><DiscussionForm /></CardContent></Card>
        <Card><CardHeader><CardTitle>Threads</CardTitle><CardDescription>Discussions visible to your account and organizations.</CardDescription></CardHeader><CardContent className="space-y-3">{discussions.length === 0 ? <p className="text-sm text-muted-foreground">No discussions yet.</p> : discussions.map((thread) => <div key={thread.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{thread.title}</div><Badge>{thread.visibility}</Badge></div><div className="text-sm text-muted-foreground">{thread.authorName} · {thread.status}</div></div>)}</CardContent></Card>
      </section>
    </PageShell>
  );
}
