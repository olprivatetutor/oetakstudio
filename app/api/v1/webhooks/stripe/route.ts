import { NextRequest } from "next/server";
import { AppError, handleRouteError, successResponse } from "@/lib/api/response";
import { verifyStripeSignature } from "@/lib/billing/stripe-webhook";
import {
  applyStripeCheckoutCompleted,
  claimWebhookEvent,
  markWebhookEventOutcome,
} from "@/features/billing/service";

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

    // §13.10/§23.1: dedupe on provider_event_id so retried deliveries never
    // double-apply — but only a *successfully processed* event is terminal, so a
    // failed attempt stays retryable when Stripe redelivers it.
    const claim = await claimWebhookEvent({
      provider: "stripe",
      providerEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
    if (!claim.claimed) {
      return successResponse({ received: true, eventId: event.id, deduplicated: true });
    }

    try {
      if (event.type === "checkout.session.completed" && event.data?.object) {
        const outcome = await applyStripeCheckoutCompleted(event.data.object);
        // An unsettled payment is not a failure to retry: Stripe will send a
        // separate async_payment_succeeded event once funds clear.
        await markWebhookEventOutcome(
          "stripe",
          event.id,
          outcome.applied ? "processed" : "ignored",
          outcome.reason,
        );
      } else {
        await markWebhookEventOutcome("stripe", event.id, "ignored", `unhandled type ${event.type}`);
      }
    } catch (error) {
      await markWebhookEventOutcome(
        "stripe",
        event.id,
        "failed",
        error instanceof Error ? error.message.slice(0, 1000) : "Unknown webhook processing error",
      );
      throw error;
    }

    return successResponse({ received: true, eventId: event.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
