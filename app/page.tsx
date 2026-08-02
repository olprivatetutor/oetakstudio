import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bot, Building2, ChartNoAxesCombined, GraduationCap, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { AuthButtons, HeroAuthButtons } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const features = [
  { title: "Adaptive tutor", icon: Bot, copy: "Contextual AI guidance, assessment feedback, and recommendations follow each learner's goals." },
  { title: "Tenant-aware", icon: Building2, copy: "Organizations, roles, courses, enrollments, and analytics stay isolated by membership." },
  { title: "Learning insights", icon: ChartNoAxesCombined, copy: "Progress, completion, certificates, and organization averages are visible in one polished workspace." },
  { title: "Credential ready", icon: GraduationCap, copy: "Completion unlocks verified certificates with durable credential IDs." },
];

const metrics = [
  { label: "Daily goal", value: "84%" },
  { label: "Streak", value: "12 days" },
  { label: "XP earned", value: "2,480" },
];

export default function Home() {
  return (
    <div className="premium-page min-h-screen overflow-hidden">
      <div className="premium-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[680px]" />
      <header className="premium-shell relative z-10 flex items-center justify-between gap-4 py-5">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <Image src="/codeguide-logo.png" alt="Oetak Studio" width={40} height={40} className="rounded-2xl shadow-[var(--shadow-xs)]" />
          <span className="font-parkinsans text-lg">Oetak Learning</span>
        </Link>
        <div className="flex items-center gap-2"><AuthButtons /><ThemeToggle /></div>
      </header>

      <main className="relative z-10">
        <section className="premium-shell grid min-h-[calc(100svh-92px)] items-center gap-12 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-12">
          <div className="space-y-8">
            <div className="eyebrow"><ShieldCheck className="h-3.5 w-3.5" />Premium AI learning SaaS</div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-normal text-foreground md:text-7xl">
                Oetak Learning Platform
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                A calm, adaptive learning workspace for individuals, teachers, and organizations with courses, progress, AI tutor support, assessments, and credentials.
              </p>
            </div>
            <HeroAuthButtons />
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border bg-card/70 p-4 shadow-[var(--shadow-xs)] backdrop-blur">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</div>
                  <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-secondary/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border bg-card/70 p-3 shadow-[var(--shadow-float)] backdrop-blur-xl">
              <Image
                src="/illustrations/edtech-hero.png"
                alt="Faceless learners and teacher using a modern learning platform"
                width={1536}
                height={1024}
                priority
                className="aspect-[4/3] w-full rounded-[1.5rem] object-cover object-center"
              />
              <Card className="absolute bottom-5 left-5 right-5 hidden gap-4 bg-card/82 p-5 backdrop-blur-xl md:flex">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Trophy className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Level progression</CardTitle><Badge variant="secondary">+320 XP</Badge></div>
                  <Progress value={72} className="mt-3" />
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="premium-shell grid gap-4 pb-10 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="group">
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105"><feature.icon className="h-6 w-6" /></div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">{feature.copy}</CardContent>
            </Card>
          ))}
        </section>

        <section className="premium-shell pb-16">
          <div className="grid gap-4 rounded-[2rem] border bg-primary p-5 text-primary-foreground shadow-[var(--shadow-float)] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div className="space-y-2">
              <Badge variant="secondary" className="bg-white/14 text-primary-foreground ring-white/20"><Sparkles className="h-3 w-3" />Designed for focused learning</Badge>
              <h2 className="text-2xl font-semibold md:text-3xl">Start with a course, grow into a learning operating system.</h2>
              <p className="max-w-2xl text-sm leading-6 text-primary-foreground/72">Enroll, build, measure, and issue credentials from one responsive dashboard.</p>
            </div>
            <Button asChild size="lg" variant="secondary"><Link href="/dashboard">Open app<ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>
    </div>
  );
}
