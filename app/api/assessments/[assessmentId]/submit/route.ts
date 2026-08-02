import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { assessmentSubmissionSchema } from "@/lib/validations";
import { submitAssessment } from "@/lib/services/learning";

type Params = { params: Promise<{ assessmentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { assessmentId } = await params;
    const input = assessmentSubmissionSchema.parse(await request.json());
    const submission = await submitAssessment(user, assessmentId, input);
    return successResponse(submission, "Assessment submitted successfully", {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
