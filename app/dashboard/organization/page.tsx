import { Building2, GraduationCap, Users } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { getOrganizationDashboard } from "@/lib/services/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrganizationForm } from "@/components/learning/organization-form";
import { formatOrganizationRole } from "@/lib/role-labels";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";
import { OrganizationMembers } from "@/components/learning/organization-members";

export default async function OrganizationPage() {
  const user = await requireUser();
  const data = await getOrganizationDashboard(user);

  return (
    <PageShell>
      <PageHeader eyebrow="Organization" title="Tenant-aware administration" description="Create organizations and view courses, members, and enrollment context attached to your account." />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Organizations" value={data.organizations.length} icon={Building2} />
        <MetricCard label="Members" value={data.members.length} icon={Users} tone="purple" />
        <MetricCard label="Org courses" value={data.courses.length} icon={GraduationCap} tone="gold" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card><CardHeader><CardTitle className="text-2xl">Create organization</CardTitle><CardDescription>Creates an isolated tenant and assigns you as owner.</CardDescription></CardHeader><CardContent><OrganizationForm /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-2xl">Your organizations</CardTitle><CardDescription>Only memberships attached to your user are visible here.</CardDescription></CardHeader><CardContent className="space-y-3">{data.organizations.length === 0 ? <p className="rounded-[1.5rem] border border-dashed bg-muted/45 p-5 text-sm text-muted-foreground">No organization membership yet.</p> : data.organizations.map((org) => <div key={org.organizationId} className="flex items-center justify-between rounded-[1.25rem] border bg-card/56 p-4"><div><div className="font-semibold">{org.name}</div><div className="text-sm text-muted-foreground">Plan {org.plan}</div></div><Badge>{formatOrganizationRole(org.role)}</Badge></div>)}</CardContent></Card>
      </section>
      {data.organizations.filter((org) => ["owner", "admin"].includes(org.role)).map((org) => <section key={org.organizationId}><Card><CardHeader><CardTitle className="text-2xl">{org.name} members</CardTitle><CardDescription>Active members and pending invitations.</CardDescription></CardHeader><CardContent><OrganizationMembers organizationId={org.organizationId} /></CardContent></Card></section>)}
    </PageShell>
  );
}
