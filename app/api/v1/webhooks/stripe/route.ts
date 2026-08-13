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

/**
 * Checkout events that may activate a subscription. `async_payment_succeeded` is
 * the settlement event for delayed payment methods, where the original
 * `completed` event arrived unpaid and was correctly ignored — without it those
 * subscriptions would never activate (§13.10).
 */
const ACTIVATING_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

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
      if (ACTIVATING_EVENT_TYPES.has(event.type) && event.data?.object) {
        // `checkout.session.completed` activates only when the payment already
        // settled; for a delayed payment method it arrives `unpaid` and is
        // ignored, and `checkout.session.async_payment_succeeded` carries the
        // same session once funds clear. Both route through one handler, whose
        // update is idempotent, so a redelivery of either cannot double-apply.
        const outcome = await applyStripeCheckoutCompleted(event.data.object);
        await markWebhookEventOutcome(
          "stripe",
          event.id,
          outcome.applied ? "processed" : "ignored",
          outcome.reason,
        );
      } else if (event.type === "checkout.session.async_payment_failed") {
        // Terminal for this session: the plan stays un-activated. Recorded
        // rather than silently dropped so the failure is auditable.
        await markWebhookEventOutcome(
          "stripe",
          event.id,
          "ignored",
          "async payment failed; subscription not activated",
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
