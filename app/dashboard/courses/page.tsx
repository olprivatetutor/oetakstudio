import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { getCurrentSession } from "@/lib/api/session";
import { listCourses } from "@/lib/services/learning";
import { paginationSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CourseCard, EmptyState, PageHeader, PageShell } from "@/components/premium/page-shell";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getCurrentSession();
  const rawParams = await searchParams;
  const params = paginationSchema.parse({
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    search: rawParams.search,
    category: rawParams.category,
    level: rawParams.level,
    sort: rawParams.sort,
  });
  const result = await listCourses(session?.user ?? null, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Course catalog"
        title="Find the next focused learning path"
        description="Search adaptive courses available to your personal account and active organization memberships."
        action={<Button asChild><Link href="/dashboard/builder"><Plus className="h-4 w-4" />Create course</Link></Button>}
      />
      <form className="glass-panel flex flex-col gap-3 rounded-[1.5rem] p-3 md:flex-row md:p-4">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input name="search" defaultValue={params.search} className="pl-11" placeholder="Search course, category, description" /></div>
        <Input name="category" defaultValue={params.category} placeholder="Category" className="md:w-56" />
        <Button type="submit">Search</Button>
      </form>
      {result.data.length === 0 ? (
        <EmptyState title="No courses found" description="Try a broader keyword or clear the category filter." action={<Button asChild><Link href="/dashboard/builder">Create a course</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.data.map((course) => (
            <CourseCard key={course.id} href={`/dashboard/courses/${course.id}`} title={course.title} description={course.description} category={course.category} level={course.level} minutes={course.estimatedMinutes} aiGenerated={course.aiGenerated} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
