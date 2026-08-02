import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { organizationMemberRoleSchema } from "@/lib/validations";
import {
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from "@/features/organizations/service";

type Params = { params: Promise<{ organizationId: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireUser();
    const { organizationId, userId } = await params;
    const { role } = organizationMemberRoleSchema.parse(await request.json());
    const member = await updateOrganizationMemberRole(
      currentUser,
      organizationId,
      userId,
      role,
    );
    return successResponse(member, "Member role updated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const currentUser = await requireUser();
    const { organizationId, userId } = await params;
    const member = await removeOrganizationMember(currentUser, organizationId, userId);
    return successResponse(member, "Member removed successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
