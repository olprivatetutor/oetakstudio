import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { getDashboardData, getOrganizationDashboard } from "@/lib/services/learning";

export async function GET() {
  try {
    const user = await requireUser();
    const [dashboard, organization] = await Promise.all([
      getDashboardData(user),
      getOrganizationDashboard(user),
    ]);

    return successResponse({ dashboard, organization });
  } catch (error) {
    return handleRouteError(error);
  }
}
