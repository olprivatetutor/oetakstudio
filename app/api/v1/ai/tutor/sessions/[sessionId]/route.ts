import { getTutorConversation } from "@/lib/ai/conversations";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/session";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    return successResponse(await getTutorConversation(user.id, sessionId));
  } catch (error) {
    return handleRouteError(error);
  }
}
