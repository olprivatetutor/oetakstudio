import { AppError } from "@/lib/api/response";
import type { BillingProvider, CheckoutInput } from "@/lib/billing/provider";

function priceEnvironmentKey(input: CheckoutInput) {
  return `STRIPE_PRICE_${input.plan.toUpperCase()}_${input.interval.toUpperCase()}`;
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";

  async createCheckout(input: CheckoutInput) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new AppError("INTERNAL_ERROR", "STRIPE_SECRET_KEY is not configured", 503);
    const priceKey = priceEnvironmentKey(input);
    const priceId = process.env[priceKey];
    if (!priceId) throw new AppError("INTERNAL_ERROR", `${priceKey} is not configured`, 503);

    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer_email: input.customerEmail,
      client_reference_id: input.subjectId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "metadata[subjectType]": input.subjectType,
      "metadata[subjectId]": input.subjectId,
      "metadata[plan]": input.plan,
      "metadata[interval]": input.interval,
      allow_promotion_codes: "true",
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !data.id || !data.url) {
      throw new AppError("INTERNAL_ERROR", data.error?.message ?? "Stripe checkout creation failed", 502);
    }
    return { id: data.id, url: data.url };
  }
}
