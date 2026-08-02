import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { personalLibraryCreateSchema } from "@/lib/validations";
import { addPersonalLibraryItem, listPersonalLibrary } from "@/lib/services/content-system";

export async function GET() {
  try {
    const user = await requireUser();
    const library = await listPersonalLibrary(user);
    return successResponse(library);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = personalLibraryCreateSchema.parse(await request.json());
    const item = await addPersonalLibraryItem(user, input);
    return successResponse(item, "Library item saved successfully", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
