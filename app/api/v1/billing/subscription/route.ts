import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { getBillingOverview } from "@/features/billing/service";

export async function GET() {
  try {
    const user = await requireUser();
    return successResponse(await getBillingOverview(user));
  } catch (error) {
    return handleRouteError(error);
  }
}
