"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenCheck, Building2, CreditCard, LayoutDashboard, ListChecks, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Tenants", href: "/admin/tenants", icon: Building2 },
  { title: "Learners", href: "/admin/learners", icon: Users },
  { title: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { title: "Billing", href: "/admin/billing", icon: BarChart3 },
  { title: "Taxonomy", href: "/admin/taxonomy", icon: BookOpenCheck },
  { title: "Activity", href: "/admin/activity", icon: ListChecks },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8" aria-label="App Owner navigation">
      {adminNavItems.map((item) => {
        const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[var(--shadow-xs)] transition-all",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-card/66 text-muted-foreground backdrop-blur hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
