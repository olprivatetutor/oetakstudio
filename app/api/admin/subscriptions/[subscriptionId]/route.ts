import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { subscriptionUpdateSchema } from "@/lib/validations";
import { updateSubscription } from "@/lib/services/app-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  try {
    const user = await requireUser();
    const { subscriptionId } = await params;
    const input = subscriptionUpdateSchema.parse(await request.json());
    const subscription = await updateSubscription(user, subscriptionId, input);
    return successResponse(subscription, "Subscription updated successfully");
  } catch (error) {
    return handleRouteError(error);
  }
}
