import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { aiTutorSchema } from "@/lib/validations";
import { askTutor } from "@/lib/ai/service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = aiTutorSchema.parse(await request.json());
    const result = await askTutor({ user, ...input });
    return successResponse(result, "AI tutor response generated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
