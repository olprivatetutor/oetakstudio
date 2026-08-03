import { listTutorConversations } from "@/lib/ai/conversations";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/session";
import { tutorConversationQuerySchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const query = tutorConversationQuerySchema.parse(Object.fromEntries(url.searchParams));
    return successResponse(await listTutorConversations(user.id, query));
  } catch (error) {
    return handleRouteError(error);
  }
}
