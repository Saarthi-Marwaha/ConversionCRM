import type { Event, EndUser } from "@/types";

// ─────────────────────────────────────────────
// Engagement scoring weights (0–100 scale)
// ─────────────────────────────────────────────
const WEIGHTS = {
  login: 5,
  feature_click: 8,
  key_feature_used: 20,
  pricing_page_visit: 15,
  page_view: 2,
  file_uploaded: 10,
  task_completed: 10,
  upgrade_clicked: 25,
  custom: 3,
} as const;

// Recency decay: events older than N days contribute less
const RECENCY_DAYS = 14;
const RECENCY_HALF_LIFE_DAYS = 7;

interface ScoreBreakdown {
  raw_points: number;
  recency_weight: number;
  final_score: number;
  by_event_type: Record<string, number>;
}

/**
 * Computes a 0–100 engagement score for a user based on their recent events.
 */
export function computeEngagementScore(
  events: Pick<Event, "event_type" | "event_name" | "occurred_at">[]
): { score: number; breakdown: ScoreBreakdown } {
  const now = Date.now();
  const cutoffMs = RECENCY_DAYS * 24 * 60 * 60 * 1000;
  const halfLifeMs = RECENCY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

  let totalWeightedPoints = 0;
  const byEventType: Record<string, number> = {};

  for (const event of events) {
    const age = now - new Date(event.occurred_at).getTime();
    if (age > cutoffMs) continue;

    const basePoints = WEIGHTS[event.event_type as keyof typeof WEIGHTS] ?? WEIGHTS.custom;
    const recencyFactor = Math.exp((-Math.LN2 * age) / halfLifeMs);
    const weighted = basePoints * recencyFactor;

    totalWeightedPoints += weighted;
    byEventType[event.event_type] =
      (byEventType[event.event_type] ?? 0) + weighted;
  }

  // Cap at 100
  const score = Math.min(100, Math.round(totalWeightedPoints));

  return {
    score,
    breakdown: {
      raw_points: totalWeightedPoints,
      recency_weight: 1,
      final_score: score,
      by_event_type: Object.fromEntries(
        Object.entries(byEventType).map(([k, v]) => [k, Math.round(v * 10) / 10])
      ),
    },
  };
}

/**
 * Determines the lifecycle stage based on the user's score and activity.
 */
export function determineStage(
  user: Pick<EndUser, "stage" | "engagement_score" | "trial_ends_at" | "converted_at" | "last_seen_at">,
  score: number,
  events: Pick<Event, "event_type" | "occurred_at">[]
): EndUser["stage"] {
  if (user.converted_at) return "paid";

  const now = new Date();
  const trialEnded =
    user.trial_ends_at && new Date(user.trial_ends_at) < now;

  if (trialEnded && !user.converted_at) return "churned";

  const daysSinceLastSeen = user.last_seen_at
    ? (now.getTime() - new Date(user.last_seen_at).getTime()) /
      (1000 * 60 * 60 * 24)
    : Infinity;

  if (score >= 70) return "conversion_ready";
  if (daysSinceLastSeen > 10) return "going_quiet";

  const recentLogins = events.filter(
    (e) =>
      e.event_type === "login" &&
      new Date(e.occurred_at).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).length;

  if (recentLogins >= 2) return "active";

  const hasKeyFeature = events.some((e) => e.event_type === "key_feature_used");
  if (!hasKeyFeature) return "onboarding";

  return "active";
}
