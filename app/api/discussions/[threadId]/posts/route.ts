import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { discussionPostCreateSchema } from "@/lib/validations";
import { addDiscussionPost } from "@/lib/services/content-system";

export async function POST(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const user = await requireUser();
    const { threadId } = await params;
    const input = discussionPostCreateSchema.parse(await request.json());
    const post = await addDiscussionPost(user, threadId, input);
    return successResponse(post, "Discussion post created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
