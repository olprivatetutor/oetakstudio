import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { organizationInviteSchema } from "@/lib/validations";
import {
  getOrganizationMembers,
  inviteOrganizationMember,
} from "@/features/organizations/service";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { organizationId } = await params;
    const result = await getOrganizationMembers(user, organizationId);
    return successResponse(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { organizationId } = await params;
    const input = organizationInviteSchema.parse(await request.json());
    const result = await inviteOrganizationMember(user, organizationId, input);
    return successResponse(result, "Invitation created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
