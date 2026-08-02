import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { onboardingSchema } from "@/lib/validations";
import { saveOnboarding } from "@/lib/services/learning";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = onboardingSchema.parse(await request.json());
    const result = await saveOnboarding(user, input);
    return successResponse(result, "Onboarding saved successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
