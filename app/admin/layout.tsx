import Link from "next/link";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { PlatformAccountMenu } from "@/components/admin/platform-account-menu";
import { requireAppOwnerPageUser } from "@/app/admin/admin-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAppOwnerPageUser();

  return (
    <div className="premium-page min-h-screen">
      <header className="sticky top-0 z-40 px-4 py-4 sm:px-6 lg:px-8">
        <div className="glass-panel mx-auto flex h-14 max-w-7xl items-center gap-3 rounded-full px-3 sm:px-4">
          <Button asChild variant="ghost" size="sm"><Link href="/admin"><LayoutDashboard className="h-4 w-4" />Owner overview</Link></Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />App Owner Console</div>
          <ThemeToggle />
          <PlatformAccountMenu user={user} />
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
