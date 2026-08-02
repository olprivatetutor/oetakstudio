import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/api/response";

export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) {
    throw new AppError("FORBIDDEN", "Invalid Stripe webhook signature", 400);
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new AppError("FORBIDDEN", "Expired Stripe webhook signature", 400);
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const valid = signatures.some((signature) => {
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    return left.length === right.length && timingSafeEqual(left, right);
  });
  if (!valid) throw new AppError("FORBIDDEN", "Invalid Stripe webhook signature", 400);
}
