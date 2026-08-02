import { AppError } from "@/lib/api/response";
import type { BillingProvider } from "@/lib/billing/provider";
import { StripeBillingProvider } from "@/lib/billing/stripe-provider";

export function createBillingProvider(
  provider = process.env.BILLING_PROVIDER ?? "stripe",
): BillingProvider {
  if (provider === "stripe") return new StripeBillingProvider();
  throw new AppError("INTERNAL_ERROR", `Unsupported billing provider: ${provider}`, 500);
}
