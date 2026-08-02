import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { curriculumCreateSchema } from "@/lib/validations";
import { createCurriculum } from "@/lib/services/content-system";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = curriculumCreateSchema.parse(await request.json());
    const curriculum = await createCurriculum(user, input);
    return successResponse(curriculum, "Curriculum created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
