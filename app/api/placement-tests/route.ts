import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { placementStartSchema } from "@/lib/validations";
import { listPlacementTests, startPlacementTest } from "@/lib/services/content-system";

export async function GET() {
  try {
    const user = await requireUser();
    const tests = await listPlacementTests(user);
    return successResponse(tests);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = placementStartSchema.parse(await request.json());
    const test = await startPlacementTest(user, input);
    return successResponse(test, "Placement test started successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
