import type { SubscriptionPlan } from "@/types/domain";

export type CheckoutInput = {
  subjectType: "individual" | "organization";
  subjectId: string;
  plan: Exclude<SubscriptionPlan, "free">;
  interval: "monthly" | "annual";
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export interface BillingProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
}
