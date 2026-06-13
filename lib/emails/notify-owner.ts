/**
 * Internal notifications to the ConversionCRM founder inbox.
 * Every feedback submission and testimonial fires one of these, clearly
 * labeled with what it is. Always sent via the platform Resend sender
 * (never the customer's SMTP).
 */
import { getResend, EMAIL_FROM } from "@/lib/resend";
import { escapeHtml } from "@/lib/emails/render-custom";

export const OWNER_EMAIL = "ceo.conversioncrm@gmail.com";

export type OwnerNotificationType =
  | "Feature request"
  | "Bug report"
  | "Testimonial";

export async function notifyOwner(opts: {
  type: OwnerNotificationType;
  workspaceName: string;
  fromEmail?: string | null;
  content: string;
  rating?: number | null;
}): Promise<void> {
  const { type, workspaceName, fromEmail, content, rating } = opts;
  const stars =
    typeof rating === "number"
      ? "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating))
      : null;

  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to: OWNER_EMAIL,
      subject: `[ConversionCRM] ${type} from ${workspaceName}`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#eff8ff;padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;">
          <p style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0b3a5e;background:#e0f2fe;border-radius:999px;padding:4px 10px;margin:0 0 14px;">${escapeHtml(
            type
          )}</p>
          ${stars ? `<p style="font-size:18px;color:#0ea5e9;margin:0 0 10px;">${stars} <span style="font-size:12px;color:#6b7280;">(${rating}/5)</span></p>` : ""}
          <p style="font-size:14px;color:#111827;line-height:1.65;white-space:pre-wrap;margin:0 0 16px;">${escapeHtml(
            content
          )}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
          <p style="font-size:12px;color:#6b7280;margin:0;">
            Workspace: <strong>${escapeHtml(workspaceName)}</strong>${
              fromEmail ? ` · From: ${escapeHtml(fromEmail)}` : ""
            }
          </p>
        </div></body></html>`,
      ...(fromEmail ? { reply_to: fromEmail } : {}),
    });
  } catch (err) {
    // Notifications are best-effort — never block the user's submission.
    console.error("[notifyOwner] failed:", err);
  }
}
