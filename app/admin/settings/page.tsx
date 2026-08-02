import { KeyRound, LockKeyhole, ServerCog, ShieldCheck } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function AdminSettingsPage() {
  const { admin } = await requireAppOwnerPageUser();

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Owner settings"
        title="App Owner settings"
        description="Pengaturan operasional untuk akses owner, mode maintenance, dan guardrail platform. Tidak ada perubahan schema atau backend API di halaman ini."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Owner role" value={admin.role} icon={ShieldCheck} />
        <MetricCard label="Access status" value={admin.status} icon={LockKeyhole} tone="purple" />
        <MetricCard label="Maintenance account" value="Enabled" icon={ServerCog} tone="gold" />
        <MetricCard label="Auth guard" value="Server" icon={KeyRound} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Owner access</CardTitle>
              <Badge>Active</Badge>
            </div>
            <CardDescription>Akses `/admin` hanya diberikan untuk user yang terdaftar aktif di `app_admins`.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Saat user biasa membuka console ini, layout akan redirect ke dashboard learner/tenant. Owner yang login akan diarahkan otomatis dari sign in dan `/dashboard` ke `/admin`.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Subscription controls</CardTitle>
              <Badge variant="secondary">Manual</Badge>
            </div>
            <CardDescription>Owner bisa mengubah plan, status, seats, billing email, renewal date, dan notes.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Kontrol ini dipakai untuk administrasi tenant dan learner individu sampai payment provider otomatis diintegrasikan.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Tenant boundary</CardTitle>
              <Badge variant="outline">Separated</Badge>
            </div>
            <CardDescription>App Owner bukan role admin tenant dan tidak mengelola course catalog tenant dari console ini.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Menu owner difokuskan pada operasi SaaS: tenant, learner individu, subscription, billing, audit activity, dan maintenance platform.
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
