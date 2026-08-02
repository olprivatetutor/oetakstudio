import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeSignature } from "@/lib/billing/stripe-webhook";

test("valid Stripe signatures are accepted", () => {
  const payload = '{"id":"evt_test"}';
  const secret = "whsec_test";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  assert.doesNotThrow(() => verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret));
});

test("tampered Stripe payloads are rejected", () => {
  const secret = "whsec_test";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.original`)
    .digest("hex");
  assert.throws(() => verifyStripeSignature("tampered", `t=${timestamp},v1=${signature}`, secret));
});
