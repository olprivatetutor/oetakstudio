import { Award, BookOpenCheck, UserRound, WalletCards } from "lucide-react";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";
import { getAppAdminLearners } from "@/lib/services/app-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader, PageShell } from "@/components/premium/page-shell";
import { SubscriptionCard } from "@/components/admin/subscription-card";

export default async function AdminLearnersPage() {
  const { user } = await requireAppOwnerPageUser();
  const learners = await getAppAdminLearners(user);
  const subscribedLearners = learners.filter((learner) => learner.status === "active" || learner.status === "trialing").length;
  const enrollments = learners.reduce((sum, learner) => sum + Number(learner.enrollmentCount ?? 0), 0);
  const certificates = learners.reduce((sum, learner) => sum + Number(learner.certificateCount ?? 0), 0);

  return (
    <PageShell className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Individual learners"
        title="Learner subscription administration"
        description="Pantau learner individu di luar tenant organisasi, termasuk paket personal, progress belajar, dan riwayat sertifikat."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Individual learners" value={learners.length} icon={UserRound} />
        <MetricCard label="Subscribed" value={subscribedLearners} icon={WalletCards} tone="gold" />
        <MetricCard label="Enrollments" value={enrollments} icon={BookOpenCheck} tone="purple" />
        <MetricCard label="Certificates" value={certificates} icon={Award} tone="stone" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {learners.length === 0 ? (
          <Card className="border-dashed xl:col-span-2">
            <CardHeader>
              <CardTitle>No individual learners yet</CardTitle>
              <CardDescription>Individual learner akan muncul di sini setelah user memilih account type personal.</CardDescription>
            </CardHeader>
          </Card>
        ) : learners.map((learner) => (
          learner.subscriptionId && learner.plan && learner.status ? (
            <SubscriptionCard
              key={learner.userId}
              id={learner.subscriptionId}
              title={learner.name ?? learner.email}
              description={learner.email}
              plan={learner.plan}
              status={learner.status}
              seats={learner.seats ?? 1}
              billingEmail={learner.billingEmail}
              currentPeriodEnd={learner.currentPeriodEnd}
              notes={learner.notes}
              meta={`${learner.enrollmentCount} enrollments · ${learner.certificateCount} certificates${learner.headline ? ` · ${learner.headline}` : ""}`}
            />
          ) : (
            <Card key={learner.userId} className="border-dashed">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{learner.name ?? learner.email}</CardTitle>
                    <CardDescription>{learner.email} · {learner.enrollmentCount} enrollments · {learner.certificateCount} certificates</CardDescription>
                  </div>
                  <Badge variant="outline">No subscription row</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                Learner lama ini belum punya subscription record. Account individu baru akan dibuatkan subscription otomatis saat onboarding.
              </CardContent>
            </Card>
          )
        ))}
      </section>
    </PageShell>
  );
}
