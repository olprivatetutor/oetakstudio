import { NextRequest } from "next/server";
import { generateCourseDraft } from "@/features/content-generation/service";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/session";
import { aiCourseGenerationSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = aiCourseGenerationSchema.parse(await request.json());
    const result = await generateCourseDraft(user, input);
    return successResponse(result, "Course draft generated successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
