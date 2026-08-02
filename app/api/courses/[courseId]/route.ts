import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema/learning";
import { requireUser } from "@/lib/api/session";
import { AppError, handleRouteError, successResponse } from "@/lib/api/response";
import { courseUpdateSchema } from "@/lib/validations";
import { canManageCourse } from "@/lib/permissions";
import { getCourseDetail, updateCourse } from "@/lib/services/learning";

type Params = { params: Promise<{ courseId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const detail = await getCourseDetail(user, courseId);
    return successResponse(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const input = courseUpdateSchema.parse(await request.json());
    const course = await updateCourse(user, courseId, input);
    return successResponse(course, "Course updated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const permission = await canManageCourse(user.id, courseId);

    if (!permission.course) {
      throw new AppError("NOT_FOUND", "Course not found", 404);
    }

    if (!permission.allowed) {
      throw new AppError("FORBIDDEN", "You cannot delete this course", 403);
    }

    await db.delete(courses).where(eq(courses.id, courseId));
    return successResponse({ id: courseId }, "Course deleted successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
