import { NextRequest } from "next/server";
import { AppError, handleRouteError, successResponse } from "@/lib/api/response";
import { verifyStripeSignature } from "@/lib/billing/stripe-webhook";
import { applyStripeCheckoutCompleted } from "@/features/billing/service";

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: Parameters<typeof applyStripeCheckoutCompleted>[0] };
};

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) {
      throw new AppError("FORBIDDEN", "Stripe webhook verification is not configured", 400);
    }
    const payload = await request.text();
    verifyStripeSignature(payload, signature, secret);
    const event = JSON.parse(payload) as StripeEvent;
    if (event.type === "checkout.session.completed" && event.data?.object) {
      await applyStripeCheckoutCompleted(event.data.object);
    }
    return successResponse({ received: true, eventId: event.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
