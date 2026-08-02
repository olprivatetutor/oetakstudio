import { redirect } from "next/navigation";
import { requireUser } from "@/lib/api/session";
import { AcceptInvitation } from "@/components/learning/accept-invitation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await requireUser();
  const { token } = await searchParams;
  if (!token) redirect("/dashboard/organization");

  return <PageShell><PageHeader eyebrow="Organization" title="Invitation" description="Review and accept your organization membership." /><Card className="max-w-xl"><CardHeader><CardTitle>Join organization</CardTitle></CardHeader><CardContent><AcceptInvitation token={token} /></CardContent></Card></PageShell>;
}
