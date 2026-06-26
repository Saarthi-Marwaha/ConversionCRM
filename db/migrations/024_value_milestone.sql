-- Migration 024: Value Milestone system — "readiness based on outcome, not engagement"
--
-- One primary value milestone per workspace (stored as JSONB config), plus the
-- per-user value evaluation persisted alongside the engagement score so the
-- nightly scoring run can blend an outcome-weighted readiness number and the
-- value-axis lifecycle state.
--
-- Backward compatible: when value_milestone is null the scorer behaves exactly
-- as before (readiness == engagement score), so existing workspaces are
-- unaffected until they configure a milestone.

-- Per-workspace milestone configuration. Shape (see lib/value-milestone.ts):
--   { enabled, label, matcher, nearValue[], vanityEvents[], weights, atRiskDays }
alter table workspaces
  add column if not exists value_milestone jsonb;

-- Per-user value evaluation, written by the scoring run into engagement_scores
-- (which is already upserted per scored user and read by the dashboard + cron).
--   value_state       — not_started | engaged | near_value | value_achieved | at_risk_after_value
--   value_achieved_at — sticky: first time the user crossed the value line
--   value_breakdown   — auditable: readiness split + evidence + near-value progress
alter table engagement_scores
  add column if not exists value_state text,
  add column if not exists value_achieved_at timestamptz,
  add column if not exists value_breakdown jsonb;

-- Note: engagement_scores.score now holds the OUTCOME-WEIGHTED readiness when a
-- milestone is configured (engagement still lives in score_breakdown). When no
-- milestone is configured, score == the engagement total exactly as before.
