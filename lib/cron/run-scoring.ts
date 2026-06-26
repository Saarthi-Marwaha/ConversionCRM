/**
 * Nightly engagement scoring — extracted from the cron route so stage
 * assignment can run immediately after without duplicating logic.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { computeWeeklyEngagementScore, type ScoringEvent } from "@/lib/scoring";
import {
  normalizeMilestoneConfig,
  evaluateValue,
  computeReadiness,
  type ValueState,
} from "@/lib/value-milestone";
import { daysAgo } from "@/lib/utils";

export type ScoredUser = {
  workspace_id: string;
  user_id: string;
  score: number;
};

export type RunScoringResult = {
  scored: number;
  errors: string[];
  /** Users successfully scored this run, grouped by workspace. */
  scoredByWorkspace: Map<string, ScoredUser[]>;
};

type WorkspaceRow = {
  id: string;
  key_feature_name: string | null;
  key_feature_event: string | null;
  key_feature_url: string | null;
  value_milestone: unknown;
};

type EventRow = {
  user_id: string | null;
  event_type: string;
  page: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

export async function runScoring(): Promise<RunScoringResult> {
  const supabase = createSupabaseAdminClient();
  const since = daysAgo(7);

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, key_feature_name, key_feature_event, key_feature_url, value_milestone"
    );

  if (wsError) {
    throw new Error(`Failed to fetch workspaces: ${wsError.message}`);
  }

  let scored = 0;
  const errors: string[] = [];
  const scoredByWorkspace = new Map<string, ScoredUser[]>();

  for (const workspace of (workspaces ?? []) as WorkspaceRow[]) {
    const workspaceScored: ScoredUser[] = [];
    const milestone = normalizeMilestoneConfig(workspace.value_milestone);

    // Sticky value achievement: carry forward the earliest time each user
    // crossed the value line so a 7-day scoring window never "forgets" it.
    const priorAchievedAt = new Map<string, string>();
    if (milestone) {
      const { data: priorRows } = await supabase
        .from("engagement_scores")
        .select("user_id, value_achieved_at")
        .eq("workspace_id", workspace.id)
        .not("value_achieved_at", "is", null);
      for (const r of (priorRows ?? []) as {
        user_id: string | null;
        value_achieved_at: string | null;
      }[]) {
        if (r.user_id && r.value_achieved_at) {
          priorAchievedAt.set(r.user_id, r.value_achieved_at);
        }
      }
    }

    const { data: events, error: evError } = await supabase
      .from("events")
      .select("user_id, event_type, page, properties, occurred_at")
      .eq("workspace_id", workspace.id)
      .gte("occurred_at", since)
      .not("user_id", "is", null);

    if (evError) {
      errors.push(`workspace:${workspace.id} – ${evError.message}`);
      continue;
    }

    const byUser = new Map<string, ScoringEvent[]>();
    for (const ev of (events ?? []) as EventRow[]) {
      if (!ev.user_id) continue;
      const list = byUser.get(ev.user_id) ?? [];
      list.push({
        event_type: ev.event_type,
        page: ev.page,
        properties: ev.properties,
        occurred_at: ev.occurred_at,
      });
      byUser.set(ev.user_id, list);
    }

    const computedAt = new Date().toISOString();

    for (const [userId, userEvents] of Array.from(byUser.entries())) {
      try {
        // Layer 1 — generic engagement (activity) from the existing scorer.
        const { score: engagement, breakdown } = computeWeeklyEngagementScore(
          userEvents,
          {
            name: workspace.key_feature_name,
            event: workspace.key_feature_event,
            url: workspace.key_feature_url,
          }
        );

        // Layer 2 — value milestone (outcome). When configured, the stored
        // `score` becomes the OUTCOME-WEIGHTED readiness so stages + emails key
        // off value, not activity. Unconfigured → readiness == engagement.
        let storedScore = engagement;
        let valueState: ValueState | null = null;
        let valueAchievedAt: string | null = null;
        let valueBreakdown: Record<string, unknown> | null = null;

        if (milestone) {
          const evaluation = evaluateValue(
            milestone,
            userEvents,
            new Date(),
            priorAchievedAt.get(userId) ?? null
          );
          const { readiness, breakdown: readinessBreakdown } = computeReadiness(
            engagement,
            evaluation,
            milestone
          );
          storedScore = readiness;
          valueState = evaluation.state;
          valueAchievedAt = evaluation.achievedAt;
          valueBreakdown = {
            engagementScore: engagement,
            readiness: readinessBreakdown,
            evidence: evaluation.evidence,
            nearValueProgress: evaluation.nearValueProgress,
            meaningfulEvents: evaluation.meaningfulEvents,
            vanityFiltered: evaluation.vanityFiltered,
          };
        }

        const { error: upsertError } = await supabase
          .from("engagement_scores")
          .upsert(
            {
              workspace_id: workspace.id,
              user_id: userId,
              end_user_id: null,
              score: storedScore,
              score_breakdown: breakdown,
              value_state: valueState,
              value_achieved_at: valueAchievedAt,
              value_breakdown: valueBreakdown,
              computed_at: computedAt,
            },
            { onConflict: "workspace_id,user_id" }
          );

        if (upsertError) {
          errors.push(`user:${userId} – ${upsertError.message}`);
          continue;
        }

        // Readiness drives lifecycle stage assignment downstream.
        workspaceScored.push({
          workspace_id: workspace.id,
          user_id: userId,
          score: storedScore,
        });
        scored++;
      } catch (err) {
        errors.push(`user:${userId} – ${String(err)}`);
      }
    }

    if (workspaceScored.length > 0) {
      scoredByWorkspace.set(workspace.id, workspaceScored);
    }
  }

  return { scored, errors, scoredByWorkspace };
}
