"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Eye,
  FileStack,
  Layers3,
  LayoutDashboard,
  PenLine,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const contentNavItems = [
  { title: "Overview", href: "/content", icon: LayoutDashboard },
  { title: "Library", href: "/content/library", icon: BookOpenCheck },
  { title: "Assets", href: "/content/assets", icon: FileStack },
  { title: "Taxonomy", href: "/content/taxonomy", icon: Layers3 },
  { title: "Builder", href: "/content/builder", icon: PenLine },
  { title: "Review", href: "/content/review", icon: ClipboardCheck },
  { title: "Analytics", href: "/content/analytics", icon: BarChart3 },
  { title: "Settings", href: "/content/settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return href === "/content" ? pathname === href : pathname.startsWith(href);
}

export function ContentNav() {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-[1.75rem] border bg-card/78 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl">
        <div className="mb-3 hidden px-2 pt-1 lg:block">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Content Studio</div>
              <div className="mt-1 text-xs text-muted-foreground">Platform library</div>
            </div>
            <Badge variant="secondary">Global</Badge>
          </div>
          <Button asChild className="mt-4 w-full justify-start" size="sm">
            <Link href="/content/builder"><Plus className="h-4 w-4" />New course</Link>
          </Button>
        </div>

        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Content Studio navigation">
          {contentNavItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-w-fit items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all lg:min-w-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 hidden border-t pt-3 lg:block">
          <Link href="/dashboard/courses" className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground">
            <Eye className="h-4 w-4" />Learner Preview
          </Link>
        </div>
      </div>
    </aside>
  );
}
