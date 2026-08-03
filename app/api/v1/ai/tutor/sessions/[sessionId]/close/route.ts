import { closeTutorConversation } from "@/lib/ai/conversations";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/session";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    return successResponse(
      await closeTutorConversation(user.id, sessionId),
      "Tutor session closed successfully",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
