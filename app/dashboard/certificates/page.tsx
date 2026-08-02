import { Award } from "lucide-react";
import { requireUser } from "@/lib/api/session";
import { listCertificates } from "@/lib/services/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function CertificatesPage() {
  const user = await requireUser();
  const certificates = await listCertificates(user);

  return (
    <PageShell>
      <PageHeader eyebrow="Credentials" title="Certificates and achievements" description="Verifiable credentials issued after completing every module in a course." />
      {certificates.length === 0 ? (
        <EmptyState title="No certificates yet" description="Complete a course to 100%, then issue a credential from the course page." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => (
            <Card key={certificate.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Award className="h-6 w-6" /></div><Badge>{certificate.status}</Badge></div>
                <CardTitle className="text-2xl">{certificate.title}</CardTitle>
                <CardDescription>{certificate.courseTitle} · {certificate.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl bg-muted/70 p-4 font-mono text-sm text-foreground/80">{certificate.credentialId}</div>
                <p className="mt-4 text-sm text-muted-foreground">Issued {certificate.issuedAt.toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
