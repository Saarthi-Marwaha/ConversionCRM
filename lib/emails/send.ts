import type React from "react";
import { getResend, EMAIL_FROM } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { EmailTrigger } from "@/types";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
  trigger: EmailTrigger;
  workspaceId: string;
  /** Widget-tracked user id (preferred for automated emails). */
  userId?: string | null;
  /** Legacy end_users row id. */
  endUserId?: string | null;
  replyTo?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Sends a transactional email via Resend and logs it to email_logs.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const {
    to,
    subject,
    react,
    trigger,
    workspaceId,
    userId,
    endUserId,
    replyTo,
    metadata,
  } = options;

  const supabase = createSupabaseAdminClient();
  const sentAt = new Date().toISOString();

  try {
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      end_user_id: endUserId ?? null,
      trigger,
      resend_message_id: data?.id ?? null,
      subject,
      status: error ? "failed" : "sent",
      sent_at: sentAt,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error(`[Email] Failed to send ${trigger}:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Email] Unexpected error sending ${trigger}:`, err);

    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      end_user_id: endUserId ?? null,
      trigger,
      resend_message_id: null,
      subject,
      status: "failed",
      sent_at: sentAt,
      metadata: { ...(metadata ?? {}), error: String(err) },
    });

    return false;
  }
}

/**
 * True if a successful send exists for this user + trigger within the window.
 * Pass `withinHours: null` to check if it was ever sent.
 */
export async function wasEmailSentRecently(
  workspaceId: string,
  userId: string,
  trigger: EmailTrigger,
  withinHours: number | null = 24
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("trigger", trigger)
    .eq("status", "sent");

  if (withinHours !== null) {
    const cutoff = new Date(
      Date.now() - withinHours * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("sent_at", cutoff);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}
