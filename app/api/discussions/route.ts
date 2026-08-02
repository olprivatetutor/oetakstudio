import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { discussionCreateSchema } from "@/lib/validations";
import { createDiscussion, listDiscussions } from "@/lib/services/content-system";

export async function GET() {
  try {
    const user = await requireUser();
    const discussions = await listDiscussions(user);
    return successResponse(discussions);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = discussionCreateSchema.parse(await request.json());
    const discussion = await createDiscussion(user, input);
    return successResponse(discussion, "Discussion created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
