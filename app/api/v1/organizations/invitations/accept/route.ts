import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { organizationAcceptInviteSchema } from "@/lib/validations";
import { acceptOrganizationInvitation } from "@/features/organizations/service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { token } = organizationAcceptInviteSchema.parse(await request.json());
    const membership = await acceptOrganizationInvitation(user, token);
    return successResponse(membership, "Organization invitation accepted");
  } catch (error) {
    return handleRouteError(error);
  }
}
