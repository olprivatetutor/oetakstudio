import { requireUser } from "@/lib/api/session";
import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function SecuritySettingsPage() {
  const user = await requireUser();
  return <PageShell><PageHeader eyebrow="Settings" title="Account security" description="Manage sign-in protection for your account." /><Card className="max-w-2xl"><CardHeader><CardTitle>Authenticator app</CardTitle></CardHeader><CardContent><TwoFactorSettings enabled={Boolean((user as typeof user & { twoFactorEnabled?: boolean }).twoFactorEnabled)} /></CardContent></Card></PageShell>;
}
