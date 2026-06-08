/**
 * POST /api/webhooks/lemonsqueezy
 *
 * Receives and processes Lemon Squeezy billing events.
 * Signature verified via HMAC-SHA256.
 *
 * Supported events:
 *   - subscription_created
 *   - subscription_updated
 *   - subscription_cancelled
 *   - subscription_expired
 *   - subscription_payment_success
 *   - subscription_payment_failed
 *   - order_created
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/types";

// Map LS subscription statuses to our internal status
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  cancelled: "cancelled",
  expired: "expired",
  paused: "cancelled",
  unpaid: "past_due",
};

export async function POST(request: NextRequest) {
  const rawBodyText = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  if (!verifyWebhookSignature(rawBodyText, signature)) {
    console.warn("[LS Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.meta
    ? (payload.meta as Record<string, unknown>).event_name
    : null;

  if (typeof eventName !== "string") {
    return NextResponse.json({ error: "Missing event_name" }, { status: 400 });
  }

  console.log(`[LS Webhook] Received: ${eventName}`);

  const supabase = createSupabaseAdminClient();

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_updated": {
        await handleSubscriptionChange(supabase, payload);
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired": {
        await handleSubscriptionEnd(supabase, payload, eventName);
        break;
      }

      case "order_created": {
        await handleOrderCreated(supabase, payload);
        break;
      }

      case "subscription_payment_success":
      case "subscription_payment_failed": {
        // TODO: log payment events and update dunning state
        break;
      }

      default:
        console.log(`[LS Webhook] Unhandled event: ${eventName}`);
    }
  } catch (err) {
    console.error(`[LS Webhook] Error processing ${eventName}:`, err);
    // Return 200 to prevent LS from retrying transient errors
    return NextResponse.json({ ok: false, error: String(err) });
  }

  return NextResponse.json({ ok: true });
}

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>
) {
  const data = (payload.data as Record<string, unknown>) ?? {};
  const attrs = (data.attributes as Record<string, unknown>) ?? {};
  const meta = (payload.meta as Record<string, unknown>) ?? {};
  const customData = (meta.custom_data as Record<string, string>) ?? {};

  const lsSubId = String(data.id);
  const status = STATUS_MAP[String(attrs.status)] ?? "active";
  const variantId = String(attrs.variant_id);
  const productName = String(attrs.product_name ?? "");
  const renewsAt = attrs.renews_at ? String(attrs.renews_at) : null;
  const endsAt = attrs.ends_at ? String(attrs.ends_at) : null;

  // custom_data should contain workspace_id and end_user_id set at checkout
  const workspaceId = customData.workspace_id;
  const endUserId = customData.end_user_id;

  if (!workspaceId || !endUserId) {
    console.warn("[LS Webhook] Missing custom_data workspace_id/end_user_id");
    return;
  }

  await supabase.from("subscriptions").upsert(
    {
      workspace_id: workspaceId,
      end_user_id: endUserId,
      lemonsqueezy_subscription_id: lsSubId,
      status,
      plan_name: productName,
      variant_id: variantId,
      renews_at: renewsAt,
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,end_user_id" }
  );

  // Mark user as paid if subscription is active/trialing
  if (status === "active") {
    await supabase
      .from("end_users")
      .update({
        stage: "paid",
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", endUserId);
  }
}

async function handleSubscriptionEnd(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
  eventName: string
) {
  const data = (payload.data as Record<string, unknown>) ?? {};
  const lsSubId = String(data.id);
  const finalStatus: SubscriptionStatus =
    eventName === "subscription_expired" ? "expired" : "cancelled";

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("end_user_id")
    .eq("lemonsqueezy_subscription_id", lsSubId)
    .single();

  if (sub?.end_user_id) {
    await supabase
      .from("subscriptions")
      .update({ status: finalStatus, updated_at: new Date().toISOString() })
      .eq("lemonsqueezy_subscription_id", lsSubId);

    await supabase
      .from("end_users")
      .update({ stage: "churned", updated_at: new Date().toISOString() })
      .eq("id", sub.end_user_id);
  }
}

async function handleOrderCreated(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>
) {
  // TODO: handle one-time purchases if added later
  console.log("[LS Webhook] order_created received — no action configured yet");
}
