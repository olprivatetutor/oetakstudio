import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { billingSubscribeSchema } from "@/lib/validations";
import { startSubscriptionCheckout } from "@/features/billing/service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = billingSubscribeSchema.parse(await request.json());
    const checkout = await startSubscriptionCheckout(user, input);
    return successResponse(checkout, "Checkout session created", { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
