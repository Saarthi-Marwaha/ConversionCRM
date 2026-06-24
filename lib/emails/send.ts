import type React from "react";
import { render } from "@react-email/render";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deliverEmail, type DeliveryWorkspace } from "@/lib/emails/transport";
import { canSendEmail } from "@/lib/usage";
import { planAllows } from "@/lib/entitlements";
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
  /** Workspace row fields used to build a per-customer From display name. */
  workspace?: {
    email_sender_name?: string | null;
    product_name?: string | null;
    name?: string | null;
  } | null;
  /** Override From display name without a full workspace object. */
  fromName?: string | null;
  metadata?: Record<string, unknown>;
}

/** Workspace fields needed to pick + drive the delivery provider + quota. */
const DELIVERY_FIELDS =
  "id, name, product_name, email_sender_name, reply_to_email, email_provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from_email, plan, email_quota, plan_status, plan_renews_at, rollover_emails";

/**
 * Sends a transactional email through the workspace's configured provider
 * (customer SMTP or platform Resend) and logs it to email_logs.
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
    workspace,
    fromName,
    metadata,
  } = options;

  const supabase = createSupabaseAdminClient();
  const sentAt = new Date().toISOString();

  // The full workspace row decides the provider (SMTP vs Resend); partial
  // rows passed by callers don't carry SMTP credentials.
  const { data: wsRow } = await supabase
    .from("workspaces")
    .select(DELIVERY_FIELDS)
    .eq("id", workspaceId)
    .maybeSingle();

  const delivery: DeliveryWorkspace = {
    ...(wsRow as DeliveryWorkspace | null),
    id: workspaceId,
    name: wsRow?.name ?? workspace?.name ?? null,
    email_sender_name:
      workspace?.email_sender_name ??
      fromName ??
      (wsRow as DeliveryWorkspace | null)?.email_sender_name,
    product_name:
      workspace?.product_name ?? (wsRow as DeliveryWorkspace | null)?.product_name,
  };

  // ── Hard monthly email quota ────────────────────────────────────────
  // Once a workspace exhausts its plan allowance we stop *sending* but keep
  // collecting data (events keep flowing via /api/events). Log a skipped
  // row and bail before delivery — nothing leaves until they upgrade or the
  // month rolls over.
  const planRow = wsRow as unknown as {
    plan?: string | null;
    email_quota?: number | null;
    plan_status?: string | null;
    plan_renews_at?: string | null;
    rollover_emails?: number | null;
  } | null;

  const quota = await canSendEmail({
    id: workspaceId,
    plan: planRow?.plan,
    email_quota: planRow?.email_quota,
    plan_status: planRow?.plan_status,
    plan_renews_at: planRow?.plan_renews_at,
    rollover_emails: planRow?.rollover_emails,
  });

  if (!quota.allowed) {
    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      end_user_id: endUserId ?? null,
      trigger,
      resend_message_id: null,
      subject,
      status: "skipped",
      sent_at: sentAt,
      metadata: {
        ...(metadata ?? {}),
        reason: "quota_exceeded",
        plan: quota.plan,
        used: quota.used,
        quota: quota.quota,
      },
    });
    console.warn(
      `[Email] Quota reached for workspace ${workspaceId} ` +
        `(${quota.used}/${quota.quota}, plan ${quota.plan}) — ${trigger} skipped.`
    );
    return false;
  }

  // ── Custom-domain (SMTP) entitlement ────────────────────────────────
  // Only Basic+ may send from their own SMTP; the Free plan falls back to the
  // platform Resend sender even if SMTP creds linger from onboarding.
  if (
    delivery.email_provider === "smtp" &&
    !planAllows(quota.plan, "custom_smtp")
  ) {
    delivery.email_provider = "resend";
  }

  try {
    // Check for a workspace-level custom email template first. Custom templates
    // are a paid feature — Free plans always send the built-in template even if
    // a row lingers from a previous paid period.
    let html: string;
    let finalSubject = subject;

    const { data: customTpl } = planAllows(quota.plan, "custom_composer")
      ? await supabase
          .from("email_templates")
          .select("subject, html_body")
          .eq("workspace_id", workspaceId)
          .eq("trigger", trigger)
          .maybeSingle()
      : { data: null };

    if (customTpl) {
      // Extract template variables from the React element props
      const props = (react as { props?: Record<string, unknown> }).props ?? {};
      const vars: Record<string, string> = {
        userName: String(props.userName ?? "there"),
        productName: String(
          props.productName ?? delivery.product_name ?? delivery.name ?? ""
        ),
        ctaUrl: String(props.checkoutUrl ?? props.appUrl ?? ""),
        appUrl: String(props.appUrl ?? ""),
        score: String(props.score ?? ""),
        limitLabel: String(props.limitLabel ?? ""),
        keyFeatureName: String(props.keyFeatureName ?? ""),
      };
      const substitute = (s: string) =>
        s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
      html = substitute(customTpl.html_body);
      finalSubject = substitute(customTpl.subject);
    } else {
      html = await render(react);
    }

    const result = await deliverEmail(delivery, {
      to,
      subject: finalSubject,
      html,
      replyTo: replyTo ?? delivery.reply_to_email,
    });

    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      end_user_id: endUserId ?? null,
      trigger,
      resend_message_id: result.messageId,
      subject: finalSubject,
      status: result.ok ? "sent" : "failed",
      sent_at: sentAt,
      metadata: {
        ...(metadata ?? {}),
        provider: result.provider,
        ...(result.error ? { error: result.error } : {}),
      },
    });

    if (!result.ok) {
      console.error(`[Email] Failed to send ${trigger}:`, result.error);
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

/**
 * Lifetime count of successful sends of a given trigger to a user. Used by the
 * persistent follow-up cap so a nudge can't repeat past followup_max_sends.
 */
export async function countEmailsSentToUser(
  workspaceId: string,
  userId: string,
  trigger: EmailTrigger
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("trigger", trigger)
    .eq("status", "sent");
  return count ?? 0;
}

/** Cooldown scoped to limit_type metadata on limit_upgrade sends. */
export async function wasLimitUpgradeSentRecently(
  workspaceId: string,
  userId: string,
  limitType: string,
  withinHours: number | null
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("trigger", "limit_upgrade")
    .eq("status", "sent")
    .contains("metadata", { limit_type: limitType });

  if (withinHours !== null) {
    const cutoff = new Date(
      Date.now() - withinHours * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("sent_at", cutoff);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}
