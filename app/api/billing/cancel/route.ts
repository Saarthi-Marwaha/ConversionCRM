/**
 * POST /api/billing/cancel
 *
 * Cancels the workspace's recurring Razorpay subscription at the end of the
 * current cycle. The customer keeps their paid features until the period ends,
 * then drops to Free (lib/usage downgrades once plan_renews_at passes).
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, updateWorkspacePlan } from "@/db/queries";
import { cancelSubscription } from "@/lib/razorpay";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (!workspace.razorpay_subscription_id || workspace.plan === "free") {
    return NextResponse.json(
      { error: "No active subscription to cancel." },
      { status: 400 }
    );
  }

  const ok = await cancelSubscription(workspace.razorpay_subscription_id, true);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not cancel. Please try again or contact support." },
      { status: 502 }
    );
  }

  // Keep access until the period ends; clear any scheduled upgrade.
  await updateWorkspacePlan(workspace.id, {
    plan_status: "cancelled",
    pending_plan: null,
    pending_plan_starts_at: null,
  });

  return NextResponse.json({
    ok: true,
    message: "Subscription cancelled. You keep your plan until the period ends.",
  });
}
