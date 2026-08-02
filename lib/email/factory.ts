import type { EmailProvider } from "@/lib/email/provider";
import { ResendEmailProvider } from "@/lib/email/resend-provider";
import { AppError } from "@/lib/api/response";

export function createEmailProvider(
  provider = process.env.EMAIL_PROVIDER ?? "resend",
): EmailProvider {
  if (provider === "resend") return new ResendEmailProvider();
  throw new AppError("INTERNAL_ERROR", `Unsupported email provider: ${provider}`, 500);
}
