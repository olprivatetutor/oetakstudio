import { requireUser } from "@/lib/api/session";
import { listNotifications } from "@/lib/services/content-system";
import { MarkNotificationsReadButton } from "@/components/learning/notification-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user);
  const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
  return (
    <PageShell>
      <PageHeader eyebrow="Notifications" title="Learning inbox" description="System, course, billing, assessment, and discussion notifications for your account." action={<MarkNotificationsReadButton ids={unreadIds} />} />
      <Card><CardHeader><CardTitle>Inbox</CardTitle><CardDescription>{unreadIds.length} unread notifications.</CardDescription></CardHeader><CardContent className="space-y-3">{notifications.length === 0 ? <p className="text-sm text-muted-foreground">No notifications yet.</p> : notifications.map((item) => <div key={item.id} className="rounded-[1rem] bg-muted/45 p-3"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{item.title}</div><Badge variant={item.readAt ? "secondary" : "default"}>{item.type}</Badge></div><div className="mt-1 text-sm text-muted-foreground">{item.body}</div></div>)}</CardContent></Card>
    </PageShell>
  );
}
