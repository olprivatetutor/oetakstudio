import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { learningObjectiveCreateSchema } from "@/lib/validations";
import { createLearningObjective } from "@/lib/services/content-system";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = learningObjectiveCreateSchema.parse(await request.json());
    const objective = await createLearningObjective(user, input);
    return successResponse(objective, "Learning objective created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
