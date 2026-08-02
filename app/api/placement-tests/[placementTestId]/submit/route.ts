import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { placementSubmitSchema } from "@/lib/validations";
import { submitPlacementTest } from "@/lib/services/content-system";

export async function POST(request: NextRequest, { params }: { params: Promise<{ placementTestId: string }> }) {
  try {
    const user = await requireUser();
    const { placementTestId } = await params;
    const input = placementSubmitSchema.parse(await request.json());
    const result = await submitPlacementTest(user, placementTestId, input);
    return successResponse(result, "Placement test submitted successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
