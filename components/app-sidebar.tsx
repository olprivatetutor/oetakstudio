"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/lib/auth-client";
import {
  IconAward,
  IconBook,
  IconBooks,
  IconChartBar,
  IconDashboard,
  IconHelp,
  IconReportAnalytics,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconTargetArrow,
  IconFolder,
  IconMessageCircle,
  IconBell,
  IconShieldCheck,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type AdminMeResponse =
  | { success: true; data: { canAccessOwnerConsole: boolean; role: string | null; canAccessContentStudio: boolean } }
  | { success: false };

const staticData = {
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Course Catalog", url: "/dashboard/courses", icon: IconBooks },
    { title: "My Learning", url: "/dashboard/learning", icon: IconBook },
    { title: "Track Planner", url: "/dashboard/tracks", icon: IconTargetArrow },
    { title: "Placement", url: "/dashboard/placement", icon: IconTargetArrow },
    { title: "Organization", url: "/dashboard/organization", icon: IconUsers },
    { title: "Analytics", url: "/dashboard/analytics", icon: IconChartBar },
  ],
  navSecondary: [
    { title: "Settings", url: "/dashboard/settings/security", icon: IconSettings },
    { title: "Billing", url: "/dashboard/settings/billing", icon: IconReportAnalytics },
    { title: "Get Help", url: "/dashboard/courses", icon: IconHelp },
    { title: "Search", url: "/dashboard/courses", icon: IconSearch },
  ],
  documents: [
    { name: "Tenant Builder", url: "/dashboard/builder", icon: IconSparkles },
    { name: "Certificates", url: "/dashboard/certificates", icon: IconAward },
    { name: "Personal Library", url: "/dashboard/library", icon: IconFolder },
    { name: "Discussions", url: "/dashboard/discussions", icon: IconMessageCircle },
    { name: "Notifications", url: "/dashboard/notifications", icon: IconBell },
    { name: "Reports", url: "/dashboard/analytics", icon: IconReportAnalytics },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();
  const [platformAccess, setPlatformAccess] = React.useState({ isAppOwner: false, canAccessContentStudio: false });

  React.useEffect(() => {
    let cancelled = false;

    async function loadPlatformAccess() {
      try {
        const response = await fetch("/api/admin/me", { cache: "no-store" });
        const result = (await response.json()) as AdminMeResponse;
        if (!cancelled && result.success) {
          setPlatformAccess({
            isAppOwner: result.data.canAccessOwnerConsole,
            canAccessContentStudio: result.data.canAccessContentStudio,
          });
        }
      } catch {
        if (!cancelled) setPlatformAccess({ isAppOwner: false, canAccessContentStudio: false });
      }
    }

    if (session?.user?.id) {
      loadPlatformAccess();
    } else {
      setPlatformAccess({ isAppOwner: false, canAccessContentStudio: false });
    }

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const platformDocuments = [
    ...(platformAccess.canAccessContentStudio ? [{ name: "Content Studio", url: "/content", icon: IconSparkles }] : []),
    ...(platformAccess.isAppOwner ? [{ name: "App Owner", url: "/admin", icon: IconShieldCheck }] : []),
  ];

  const userData = session?.user
    ? {
        name: session.user.name || "User",
        email: session.user.email,
        avatar: session.user.image || "/codeguide-logo.png",
      }
    : {
        name: "Guest",
        email: "guest@example.com",
        avatar: "/codeguide-logo.png",
      };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-14 rounded-2xl px-2">
              <Link href="/dashboard">
                <Image src="/codeguide-logo.png" alt="Oetak Studio" width={38} height={38} className="rounded-2xl shadow-[var(--shadow-xs)]" />
                <span className="text-base font-semibold font-parkinsans">Oetak Learning</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mx-2 rounded-3xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-soft)]">
          <div className="text-xs font-medium uppercase tracking-[0.14em] opacity-70">Today</div>
          <div className="mt-2 text-lg font-semibold">Build your streak</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/18">
            <div className="h-full w-2/3 rounded-full bg-white" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={staticData.navMain} />
        <NavDocuments items={[...platformDocuments, ...staticData.documents]} />
        <NavSecondary items={staticData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
