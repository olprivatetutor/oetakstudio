import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { issueCertificate, listCertificates } from "@/lib/services/learning";

const certificateCreateSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const certificates = await listCertificates(user);
    return successResponse(certificates);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = certificateCreateSchema.parse(await request.json());
    const certificate = await issueCertificate(user, input.enrollmentId);
    return successResponse(certificate, "Certificate issued successfully", {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
