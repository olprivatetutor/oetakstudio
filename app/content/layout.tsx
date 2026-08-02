import Link from "next/link";
import { BookOpenCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlatformAccountMenu } from "@/components/admin/platform-account-menu";
import { ContentNav } from "@/components/content/content-nav";
import { requireContentStudioPageUser } from "@/app/content/content-context";

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const { user, admin } = await requireContentStudioPageUser();
  const canOpenOwnerConsole = ["owner", "admin"].includes(admin.role);

  return (
    <div className="premium-page min-h-screen">
      <header className="sticky top-0 z-40 px-4 py-4 sm:px-6 lg:px-8">
        <div className="glass-panel mx-auto flex h-14 max-w-[96rem] items-center gap-3 rounded-full px-3 sm:px-4">
          <Link href="/content" className="flex min-w-0 items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-xs)]"><BookOpenCheck className="h-4 w-4" /></span>
            <span className="hidden sm:inline">Content Studio</span>
          </Link>
          <div className="flex-1" />
          {canOpenOwnerConsole && <Button asChild variant="ghost" size="sm"><Link href="/admin"><ShieldCheck className="h-4 w-4" />Owner</Link></Button>}
          <ThemeToggle />
          <PlatformAccountMenu user={user} />
        </div>
      </header>
      <div className="mx-auto grid max-w-[96rem] gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:px-8">
        <ContentNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
