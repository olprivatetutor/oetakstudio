import { handleRouteError, successResponse } from "@/lib/api/response";
import { listBillingPlans } from "@/features/billing/service";

export async function GET() {
  try {
    return successResponse(await listBillingPlans());
  } catch (error) {
    return handleRouteError(error);
  }
}
