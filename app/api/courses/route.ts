import { NextRequest } from "next/server";
import { getCurrentSession, requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { courseCreateSchema, paginationSchema } from "@/lib/validations";
import { createCourse, listCourses } from "@/lib/services/learning";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    const params = paginationSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const courses = await listCourses(session?.user ?? null, params);
    return successResponse(courses);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = courseCreateSchema.parse(await request.json());
    const course = await createCourse(user, input);
    return successResponse(course, "Course created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
