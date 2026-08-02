import Link from "next/link";
import { BookOpen, Command, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center px-4 pt-4 transition-[width,height] ease-linear lg:px-8">
      <div className="glass-panel flex h-14 w-full items-center gap-3 rounded-full px-3 sm:px-4">
        <SidebarTrigger className="size-10 rounded-full" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden size-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Oetak Learning</div>
            <div className="hidden truncate text-xs text-muted-foreground sm:block">Adaptive learning workspace</div>
          </div>
        </div>
        <div className="command-bar flex-1 justify-start lg:max-w-md">
          <Search className="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">Search courses, progress, certificates</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-[var(--shadow-xs)] ring-1 ring-border/45"><Command className="h-3 w-3" />K</span>
        </div>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/dashboard/builder"><Sparkles className="h-4 w-4" />Create</Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
