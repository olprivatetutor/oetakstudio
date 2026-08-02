import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { organizationCreateSchema } from "@/lib/validations";
import { createOrganization, getOrganizationDashboard } from "@/lib/services/learning";

export async function GET() {
  try {
    const user = await requireUser();
    const organizations = await getOrganizationDashboard(user);
    return successResponse(organizations);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = organizationCreateSchema.parse(await request.json());
    const organization = await createOrganization(user, input);
    return successResponse(organization, "Organization created successfully", {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
