/**
 * One-off backfill: evaluate the value milestone over each user's FULL event
 * history (the nightly scorer only sees a 7-day window, so without this a user
 * who achieved value weeks ago wouldn't be marked value-achieved until they do
 * it again). Writes value_state / value_achieved_at / value_breakdown onto
 * existing engagement_scores rows; the next nightly run then blends readiness
 * using the now-sticky value_achieved_at.
 *
 * Idempotent and safe to re-run. Only updates rows that already exist (users
 * with at least one engagement score); brand-new users are picked up by the
 * normal nightly run.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  normalizeMilestoneConfig,
  evaluateValue,
  type MilestoneEvent,
} from "@/lib/value-milestone";

export type BackfillResult = {
  workspacesProcessed: number;
  usersUpdated: number;
  errors: string[];
};

type EventRow = {
  user_id: string | null;
  event_type: string;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

export async function backfillValueMilestones(): Promise<BackfillResult> {
  const supabase = createSupabaseAdminClient();
  const result: BackfillResult = {
    workspacesProcessed: 0,
    usersUpdated: 0,
    errors: [],
  };

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, value_milestone")
    .not("value_milestone", "is", null);

  if (wsError) {
    result.errors.push(`workspaces – ${wsError.message}`);
    return result;
  }

  for (const ws of (workspaces ?? []) as { id: string; value_milestone: unknown }[]) {
    const milestone = normalizeMilestoneConfig(ws.value_milestone);
    if (!milestone) continue; // disabled or invalid → nothing to backfill
    result.workspacesProcessed++;

    // Full history (capped) so achievement detection isn't windowed.
    const { data: events, error: evError } = await supabase
      .from("events")
      .select("user_id, event_type, properties, occurred_at")
      .eq("workspace_id", ws.id)
      .not("user_id", "is", null)
      .order("occurred_at", { ascending: true })
      .limit(50000);

    if (evError) {
      result.errors.push(`workspace:${ws.id} events – ${evError.message}`);
      continue;
    }

    const byUser = new Map<string, MilestoneEvent[]>();
    for (const ev of (events ?? []) as EventRow[]) {
      if (!ev.user_id) continue;
      const list = byUser.get(ev.user_id) ?? [];
      list.push({
        event_type: ev.event_type,
        properties: ev.properties,
        occurred_at: ev.occurred_at,
      });
      byUser.set(ev.user_id, list);
    }

    for (const [userId, userEvents] of Array.from(byUser.entries())) {
      try {
        const evaluation = evaluateValue(milestone, userEvents);
        const { error: updErr } = await supabase
          .from("engagement_scores")
          .update({
            value_state: evaluation.state,
            value_achieved_at: evaluation.achievedAt,
            value_breakdown: {
              backfilled: true,
              evidence: evaluation.evidence,
              nearValueProgress: evaluation.nearValueProgress,
              meaningfulEvents: evaluation.meaningfulEvents,
            },
          })
          .eq("workspace_id", ws.id)
          .eq("user_id", userId);

        if (updErr) {
          result.errors.push(`user:${userId} – ${updErr.message}`);
        } else {
          result.usersUpdated++;
        }
      } catch (err) {
        result.errors.push(`user:${userId} – ${String(err)}`);
      }
    }
  }

  return result;
}
