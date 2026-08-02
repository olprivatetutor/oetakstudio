import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { taxonomyQuerySchema } from "@/lib/validations";
import { listTaxonomy } from "@/lib/services/content-system";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    const query = taxonomyQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const taxonomy = await listTaxonomy(query, session?.user ?? null);
    return successResponse(taxonomy);
  } catch (error) {
    return handleRouteError(error);
  }
}
