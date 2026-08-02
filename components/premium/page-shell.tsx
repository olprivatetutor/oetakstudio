import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type IconType = ElementType<{ className?: string }>;

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("flex flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8", className)}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-[1.75rem] border bg-card/62 p-5 shadow-[var(--shadow-card)] backdrop-blur-xl md:flex-row md:items-end md:justify-between md:p-7">
      <div className="max-w-3xl space-y-3">
        {eyebrow && <div className="eyebrow"><Sparkles className="h-3.5 w-3.5" />{eyebrow}</div>}
        <div className="space-y-2">
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-normal md:text-4xl">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div>}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: ReactNode;
  description?: string;
  icon: IconType;
  tone?: "green" | "purple" | "gold" | "stone";
}) {
  const toneClasses = {
    green: "bg-primary/10 text-primary",
    purple: "bg-secondary/12 text-secondary dark:text-secondary-foreground",
    gold: "bg-[#d8bd72]/20 text-[#8a6532] dark:text-[#e8cc82]",
    stone: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="group overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <div className={cn("rounded-2xl p-2.5 transition-transform duration-300 group-hover:scale-105", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <CardTitle className="text-3xl md:text-4xl">{value}</CardTitle>
      </CardHeader>
      {description && <CardContent className="text-sm leading-6 text-muted-foreground">{description}</CardContent>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="items-center justify-center border-dashed bg-card/58 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription className="mx-auto mt-2 max-w-md">{description}</CardDescription>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function CourseCard({
  href,
  title,
  description,
  category,
  level,
  minutes,
  aiGenerated,
  action = "Open",
}: {
  href: string;
  title: string;
  description: string;
  category: string;
  level: string;
  minutes?: number;
  aiGenerated?: boolean;
  action?: string;
}) {
  return (
    <Card className="group overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{category}</Badge>
          <Badge variant="outline">{level}</Badge>
          {aiGenerated && <Badge>AI assisted</Badge>}
        </div>
        <CardTitle className="line-clamp-2 text-xl">{title}</CardTitle>
        <CardDescription className="line-clamp-3">{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex items-center justify-between gap-3">
        {typeof minutes === "number" ? <span className="soft-status">{minutes} min</span> : <span />}
        <Button asChild variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground">
          <Link href={href}>{action}<ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProgressFeatureCard({
  title,
  description,
  value,
  badge,
}: {
  title: string;
  description: string;
  value: number;
  badge?: string;
}) {
  return (
    <Card className="bg-primary text-primary-foreground dark:bg-card dark:text-card-foreground">
      <CardHeader>
        {badge && <Badge variant="secondary" className="w-fit bg-white/14 text-primary-foreground ring-white/20 dark:text-secondary-foreground">{badge}</Badge>}
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-primary-foreground/74 dark:text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={value} className="bg-white/18" />
        <div className="text-sm text-primary-foreground/76 dark:text-muted-foreground">{value}% complete</div>
      </CardContent>
    </Card>
  );
}
