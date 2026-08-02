import { AppError } from "@/lib/api/response";
import type { EmailMessage, EmailProvider } from "@/lib/email/provider";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new AppError(
        "INTERNAL_ERROR",
        "RESEND_API_KEY and EMAIL_FROM are required for transactional email",
        503,
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new AppError("INTERNAL_ERROR", "Transactional email delivery failed", 502);
    }
  }
}
