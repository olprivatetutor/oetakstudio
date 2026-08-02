import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { progressUpdateSchema } from "@/lib/validations";
import { updateModuleProgress } from "@/lib/services/learning";

type Params = { params: Promise<{ moduleId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { moduleId } = await params;
    const input = progressUpdateSchema.parse(await request.json());
    const progress = await updateModuleProgress(user, moduleId, input);
    return successResponse(progress, "Progress updated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
