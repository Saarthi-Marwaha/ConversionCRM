/**
 * Monthly email-send quota with rollover.
 *
 * Effective quota for the current month = the plan's base quota + any unused
 * emails carried over from last month (`rollover_emails`, capped at one
 * month's base so it can't grow without bound). Once a workspace exhausts
 * the effective quota, outbound email stops for the month — but data
 * collection (the tracking widget → /api/events) keeps running regardless.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { updateWorkspacePlan } from "@/db/queries";
import { planById, type PlanId } from "@/lib/plans";

/** Minimal shape needed to resolve a workspace's effective plan + quota. */
export interface PlanBearingWorkspace {
  id: string;
  plan?: PlanId | string | null;
  email_quota?: number | null;
  plan_status?: string | null;
  plan_renews_at?: string | null;
  rollover_emails?: number | null;
  usage_period?: string | null;
  pending_plan?: PlanId | string | null;
  pending_plan_starts_at?: string | null;
}

/**
 * Applies a scheduled upgrade once its start date (the previous cycle's end)
 * has passed. The Razorpay webhook normally does this via plan_id; this is the
 * safety net so the dashboard reflects the change even if a webhook is delayed.
 * Returns the plan id now in effect.
 */
export async function reconcilePlan(
  ws: PlanBearingWorkspace
): Promise<PlanId> {
  const current = (ws.plan as PlanId) || "free";
  if (!ws.pending_plan || !ws.pending_plan_starts_at) return current;
  if (Date.now() < Date.parse(ws.pending_plan_starts_at)) return current;

  const plan = ws.pending_plan as PlanId;
  const quota = planById(plan).emailQuota;
  await updateWorkspacePlan(ws.id, {
    plan,
    email_quota: quota,
    plan_status: "active",
    pending_plan: null,
    pending_plan_starts_at: null,
  });
  // Keep the in-memory object consistent for the rest of this render.
  ws.plan = plan;
  ws.email_quota = quota;
  ws.pending_plan = null;
  ws.pending_plan_starts_at = null;
  return plan;
}

/** Start of the current month in UTC, ISO string. */
export function startOfCurrentMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Current month as a YYYY-MM-01 date string (UTC). */
function currentPeriod(now = new Date()): string {
  return startOfCurrentMonthIso(now).slice(0, 10);
}

/**
 * Resolve the plan + BASE monthly quota that applies right now (before
 * rollover). A cancelled / past-due subscription keeps its quota until the
 * paid period ends (plan_renews_at), then falls back to Free.
 */
export function effectivePlan(ws: PlanBearingWorkspace): {
  plan: PlanId;
  quota: number;
} {
  const planId = (ws.plan as PlanId) || "free";
  const def = planById(planId);

  const inGrace =
    ws.plan_status === "cancelled" || ws.plan_status === "past_due";
  if (inGrace) {
    const renews = ws.plan_renews_at ? Date.parse(ws.plan_renews_at) : 0;
    if (!renews || Date.now() > renews) {
      return { plan: "free", quota: planById("free").emailQuota };
    }
  }

  const quota =
    typeof ws.email_quota === "number" && ws.email_quota > 0
      ? ws.email_quota
      : def.emailQuota;
  return { plan: planId, quota };
}

/** Count successfully-sent emails for a workspace within [startIso, endIso). */
async function countSentBetween(
  workspaceId: string,
  startIso: string,
  endIso?: string
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "sent")
    .gte("sent_at", startIso);
  if (endIso) q = q.lt("sent_at", endIso);
  const { count } = await q;
  return count ?? 0;
}

/** Emails sent so far in the current calendar month. */
export async function getMonthlyEmailUsage(workspaceId: string): Promise<number> {
  return countSentBetween(workspaceId, startOfCurrentMonthIso());
}

/**
 * Roll unused emails into the current month. Idempotent: only does work the
 * first time it's called in a new month. Returns the rollover credit that
 * now applies. Safe to call on every dashboard load.
 */
export async function reconcileRollover(
  ws: PlanBearingWorkspace
): Promise<number> {
  const period = currentPeriod();
  const stored = ws.usage_period ? String(ws.usage_period).slice(0, 10) : null;

  if (stored === period) {
    return ws.rollover_emails ?? 0;
  }

  // First time we've ever reconciled — nothing to carry over yet.
  if (!stored) {
    await updateWorkspacePlan(ws.id, {
      rollover_emails: 0,
      usage_period: period,
    });
    return 0;
  }

  const { quota: baseQuota } = effectivePlan(ws);
  const prevStartIso = `${stored}T00:00:00.000Z`;
  const usedPrev = await countSentBetween(
    ws.id,
    prevStartIso,
    startOfCurrentMonthIso()
  );
  const prevEffective = baseQuota + (ws.rollover_emails ?? 0);
  // Carry leftover, capped at one month's base quota.
  const leftover = Math.max(0, Math.min(baseQuota, prevEffective - usedPrev));

  await updateWorkspacePlan(ws.id, {
    rollover_emails: leftover,
    usage_period: period,
  });
  return leftover;
}

export interface QuotaState {
  plan: PlanId;
  used: number;
  /** Effective cap this month = baseQuota + rollover. */
  quota: number;
  baseQuota: number;
  rollover: number;
  remaining: number;
  allowed: boolean;
  /** 0–100, clamped. */
  percent: number;
}

/** Full quota snapshot for a workspace (used by the dashboard + gates). */
export async function getQuotaState(
  ws: PlanBearingWorkspace
): Promise<QuotaState> {
  const { plan, quota: baseQuota } = effectivePlan(ws);
  const rollover = ws.rollover_emails ?? 0;
  const quota = baseQuota + rollover;
  const used = await getMonthlyEmailUsage(ws.id);
  const remaining = Math.max(0, quota - used);
  return {
    plan,
    used,
    quota,
    baseQuota,
    rollover,
    remaining,
    allowed: used < quota,
    percent: quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100,
  };
}

/**
 * Cheap pre-send gate: true when the workspace still has email headroom this
 * month (base quota + rollover). Used right before delivering any email.
 */
export async function canSendEmail(ws: PlanBearingWorkspace): Promise<{
  allowed: boolean;
  used: number;
  quota: number;
  plan: PlanId;
}> {
  const { plan, quota: baseQuota } = effectivePlan(ws);
  const quota = baseQuota + (ws.rollover_emails ?? 0);
  const used = await getMonthlyEmailUsage(ws.id);
  return { allowed: used < quota, used, quota, plan };
}
