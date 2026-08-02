import { getGenerationJob } from "@/features/content-generation/service";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/session";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireUser();
    const { jobId } = await context.params;
    const job = await getGenerationJob(user, jobId);
    return successResponse(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
