import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { enrollInCourse } from "@/lib/services/learning";

type Params = { params: Promise<{ courseId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const enrollment = await enrollInCourse(user, courseId);
    return successResponse(enrollment, "Enrollment completed successfully", {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
