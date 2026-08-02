import { NextRequest } from "next/server";
import { getCurrentSession, requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { contentAssetCreateSchema } from "@/lib/validations";
import { createContentAsset, listContentAssets } from "@/lib/services/content-system";

export async function GET() {
  try {
    const session = await getCurrentSession();
    const assets = await listContentAssets(session?.user ?? null);
    return successResponse(assets);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = contentAssetCreateSchema.parse(await request.json());
    const asset = await createContentAsset(user, input);
    return successResponse(asset, "Content asset created successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
