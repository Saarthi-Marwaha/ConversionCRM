/**
 * Value Milestone engine — "readiness based on outcome, not engagement."
 *
 * The existing engagement score (lib/scoring.ts) measures *activity*: clicks,
 * pageviews, time, recency. This module measures *value*: has the user crossed
 * the one outcome the product exists to deliver (e.g. "first project created",
 * "first integration connected", "first successful transaction")?
 *
 * It is intentionally **dependency-free and pure** so it can be:
 *   - unit-tested in plain Node with no DB,
 *   - reused from the scoring cron, the live dashboard API, and a backfill job,
 *   - audited — every "value achieved" decision carries the evidence that
 *     produced it.
 *
 * Design assumptions (smallest sensible defaults — documented per the brief):
 *   - One PRIMARY milestone per workspace (the brief says "one primary value
 *     milestone"). Multiple prerequisites are modelled via near-value heuristics
 *     and computed (all/any/count) matchers, not multiple primary milestones.
 *   - Value achievement is STICKY: once a user has crossed the line, they stay
 *     "valuable" even if later inactive (they become at_risk_after_value, never
 *     fall back to engaged). Callers persist `value_achieved_at` and pass it
 *     back as `priorAchievedAt` so a 7-day scoring window never "forgets" it.
 *   - Event matching is case-insensitive on event_type (the ingest path and the
 *     engagement scorer already lower-case types).
 */

// ── Event shape (subset of ScoringEvent) ───────────────────────────────────────

export type MilestoneEvent = {
  event_type: string;
  properties?: Record<string, unknown> | null;
  occurred_at: string; // ISO timestamp
};

// ── Matchers — what counts as the value outcome ────────────────────────────────
//
// Covers the three required mappings:
//   - a custom event name           → { kind: "event", event }
//   - a server-side event           → { kind: "event", event }  (same path; the
//                                       ingest endpoint is shared by FE and BE)
//   - a computed multi-event/-prop  → { kind: "all" | "any" | "count" | "property" }

export type MilestoneMatcher =
  | { kind: "event"; event: string }
  | {
      kind: "property";
      event: string;
      property: string;
      equals?: string | number | boolean;
      exists?: boolean;
    }
  | { kind: "count"; event: string; atLeast: number }
  | { kind: "all"; of: MilestoneMatcher[] }
  | { kind: "any"; of: MilestoneMatcher[] };

// ── Near-value heuristics — "close but stalled" ────────────────────────────────

export type NearValueHeuristic =
  // completed a fraction of required steps / used all prerequisite features
  | { kind: "prerequisites"; events: string[]; fraction?: number }
  // repeated attempts at the core workflow without completing it
  | { kind: "repeated_attempts"; event: string; atLeast: number }
  // reached a key precondition (e.g. connected integration) but not the outcome
  | { kind: "reached_event"; event: string };

export type MilestoneWeights = {
  /** Points added to readiness once value is achieved (dominant signal). */
  valueBoost: number;
  /** Points added when the user is near value, scaled by progress. */
  nearValueBoost: number;
  /** 0..1 multiplier on the generic engagement score (kept modest). */
  engagementWeight: number;
};

export type ValueMilestoneConfig = {
  enabled: boolean;
  /** Human label shown in the UI, e.g. "First project created". */
  label: string;
  matcher: MilestoneMatcher;
  nearValue: NearValueHeuristic[];
  /** Event types that should NOT inflate value/near-value/engagement. */
  vanityEvents: string[];
  weights: MilestoneWeights;
  /** Days of inactivity after value before a user is flagged at-risk. */
  atRiskDays: number;
};

export const DEFAULT_WEIGHTS: MilestoneWeights = {
  // 75 (not 70) so a value-achieved user ALWAYS clears the conversion-ready
  // stage cutoff (score >= 71 in assign-stages) even with zero engagement —
  // while near-value (max 0.4*100 + 25 = 65) and engaged (max 40) never do.
  valueBoost: 75,
  nearValueBoost: 25,
  engagementWeight: 0.4,
};
export const DEFAULT_AT_RISK_DAYS = 14;
/** Best near-value progress (0..1) at or above which a user is "near value". */
export const NEAR_VALUE_THRESHOLD = 0.6;
/** Readiness at/above which a user is conversion-ready (matches assign-stages). */
export const READINESS_THRESHOLD = 71;

// ── Lifecycle (value axis) ─────────────────────────────────────────────────────

export type ValueState =
  | "not_started"
  | "engaged"
  | "near_value"
  | "value_achieved"
  | "at_risk_after_value";

export type MilestoneEvidence = {
  /** When this piece of evidence occurred. */
  at: string;
  /** Which rule produced it (matcher kind / heuristic). */
  via: string;
  /** Human-readable explanation for auditing. */
  detail: string;
};

export type ValueEvaluation = {
  state: ValueState;
  achieved: boolean;
  achievedAt: string | null;
  /** Auditable: exactly why the user is (or isn't) value-achieved. */
  evidence: MilestoneEvidence[];
  /** 0..1 — best progress toward value across the near-value heuristics. */
  nearValueProgress: number;
  /** Count of non-vanity events (real activity). */
  meaningfulEvents: number;
  /** Count of vanity events that were ignored. */
  vanityFiltered: number;
  lastSeenAt: string | null;
};

// ── Config normalisation (DB JSON → full config with defaults) ──────────────────

/**
 * Coerce a stored/partial config into a complete, safe config. Returns null
 * when there is no usable milestone (so callers fall back to pure-engagement
 * behaviour — fully backward compatible).
 */
export function normalizeMilestoneConfig(
  raw: unknown
): ValueMilestoneConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.enabled === false) return null;
  if (!isMatcher(r.matcher)) return null;

  const weightsRaw = (r.weights ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : d;

  return {
    enabled: true,
    label: typeof r.label === "string" && r.label.trim() ? r.label : "Value milestone",
    matcher: r.matcher as MilestoneMatcher,
    nearValue: Array.isArray(r.nearValue)
      ? (r.nearValue.filter(isNearHeuristic) as NearValueHeuristic[])
      : [],
    vanityEvents: Array.isArray(r.vanityEvents)
      ? r.vanityEvents.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase())
      : [],
    weights: {
      valueBoost: num(weightsRaw.valueBoost, DEFAULT_WEIGHTS.valueBoost),
      nearValueBoost: num(weightsRaw.nearValueBoost, DEFAULT_WEIGHTS.nearValueBoost),
      engagementWeight: num(weightsRaw.engagementWeight, DEFAULT_WEIGHTS.engagementWeight),
    },
    atRiskDays: num(r.atRiskDays, DEFAULT_AT_RISK_DAYS),
  };
}

function isMatcher(v: unknown): v is MilestoneMatcher {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  switch (m.kind) {
    case "event":
      return typeof m.event === "string" && m.event.length > 0;
    case "property":
      return typeof m.event === "string" && typeof m.property === "string";
    case "count":
      return typeof m.event === "string" && typeof m.atLeast === "number";
    case "all":
    case "any":
      return Array.isArray(m.of) && m.of.length > 0 && m.of.every(isMatcher);
    default:
      return false;
  }
}

function isNearHeuristic(v: unknown): v is NearValueHeuristic {
  if (!v || typeof v !== "object") return false;
  const h = v as Record<string, unknown>;
  switch (h.kind) {
    case "prerequisites":
      return Array.isArray(h.events) && h.events.length > 0;
    case "repeated_attempts":
      return typeof h.event === "string" && typeof h.atLeast === "number";
    case "reached_event":
      return typeof h.event === "string";
    default:
      return false;
  }
}

// ── Matcher evaluation ─────────────────────────────────────────────────────────

type MatcherResult = {
  satisfied: boolean;
  /** Timestamp at which the matcher first became satisfied (sticky achievedAt). */
  at: string | null;
  evidence: MilestoneEvidence[];
};

const lc = (s: string) => s.toLowerCase();

function propMatches(
  ev: MilestoneEvent,
  m: Extract<MilestoneMatcher, { kind: "property" }>
): boolean {
  if (lc(ev.event_type) !== lc(m.event)) return false;
  const val = ev.properties?.[m.property];
  if (m.exists === true) return val !== undefined && val !== null;
  if (m.exists === false) return val === undefined || val === null;
  if (m.equals !== undefined) return val === m.equals;
  return val !== undefined && val !== null; // property present is enough
}

/** Events MUST be pre-sorted ascending by occurred_at. */
function evalMatcher(matcher: MilestoneMatcher, events: MilestoneEvent[]): MatcherResult {
  switch (matcher.kind) {
    case "event": {
      const hit = events.find((e) => lc(e.event_type) === lc(matcher.event));
      return hit
        ? {
            satisfied: true,
            at: hit.occurred_at,
            evidence: [{ at: hit.occurred_at, via: "event", detail: `Fired "${matcher.event}"` }],
          }
        : { satisfied: false, at: null, evidence: [] };
    }
    case "property": {
      const hit = events.find((e) => propMatches(e, matcher));
      return hit
        ? {
            satisfied: true,
            at: hit.occurred_at,
            evidence: [
              {
                at: hit.occurred_at,
                via: "property",
                detail: `"${matcher.event}" with ${matcher.property}${
                  matcher.equals !== undefined ? `=${String(matcher.equals)}` : matcher.exists === false ? " absent" : " present"
                }`,
              },
            ],
          }
        : { satisfied: false, at: null, evidence: [] };
    }
    case "count": {
      const hits = events.filter((e) => lc(e.event_type) === lc(matcher.event));
      if (hits.length >= matcher.atLeast) {
        const at = hits[matcher.atLeast - 1].occurred_at; // time of the Nth
        return {
          satisfied: true,
          at,
          evidence: [
            { at, via: "count", detail: `"${matcher.event}" ×${hits.length} (needed ${matcher.atLeast})` },
          ],
        };
      }
      return { satisfied: false, at: null, evidence: [] };
    }
    case "all": {
      const subs = matcher.of.map((m) => evalMatcher(m, events));
      if (!subs.every((s) => s.satisfied)) {
        return { satisfied: false, at: null, evidence: [] };
      }
      // Satisfied only once the LAST required condition is met.
      const at = subs.reduce<string>((max, s) => (s.at! > max ? s.at! : max), subs[0].at!);
      return { satisfied: true, at, evidence: subs.flatMap((s) => s.evidence) };
    }
    case "any": {
      const subs = matcher.of.map((m) => evalMatcher(m, events)).filter((s) => s.satisfied);
      if (subs.length === 0) return { satisfied: false, at: null, evidence: [] };
      const earliest = subs.reduce((min, s) => (s.at! < min.at! ? s : min), subs[0]);
      return { satisfied: true, at: earliest.at, evidence: earliest.evidence };
    }
  }
}

// ── Near-value evaluation ──────────────────────────────────────────────────────

type NearResult = { progress: number; evidence: MilestoneEvidence[] };

function evalNearValue(
  heuristics: NearValueHeuristic[],
  events: MilestoneEvent[]
): NearResult {
  let best = 0;
  let evidence: MilestoneEvidence[] = [];
  const lastAt = events.length ? events[events.length - 1].occurred_at : new Date().toISOString();

  for (const h of heuristics) {
    let progress = 0;
    let detail = "";
    if (h.kind === "prerequisites") {
      const want = h.events.map(lc);
      const seen = new Set(events.map((e) => lc(e.event_type)).filter((t) => want.includes(t)));
      progress = want.length ? seen.size / want.length : 0;
      detail = `${seen.size}/${want.length} prerequisites done`;
    } else if (h.kind === "repeated_attempts") {
      const tries = events.filter((e) => lc(e.event_type) === lc(h.event)).length;
      progress = h.atLeast > 0 ? Math.min(tries / h.atLeast, 1) : 0;
      detail = `${tries}/${h.atLeast} attempts at "${h.event}"`;
    } else {
      const seen = events.some((e) => lc(e.event_type) === lc(h.event));
      progress = seen ? 1 : 0;
      detail = seen ? `reached "${h.event}"` : `not yet "${h.event}"`;
    }
    if (progress > best) {
      best = progress;
      evidence = [{ at: lastAt, via: `near:${h.kind}`, detail }];
    }
  }
  return { progress: best, evidence };
}

// ── Main evaluation ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/**
 * Evaluate a user's value state from their events.
 *
 * @param priorAchievedAt  previously-persisted achievement time (sticky); pass
 *                         it so a short scoring window never forgets past value.
 */
export function evaluateValue(
  config: ValueMilestoneConfig,
  events: MilestoneEvent[],
  now: Date = new Date(),
  priorAchievedAt: string | null = null
): ValueEvaluation {
  const vanity = new Set(config.vanityEvents.map(lc));
  const all = [...events].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
  const meaningful = all.filter((e) => !vanity.has(lc(e.event_type)));
  const vanityFiltered = all.length - meaningful.length;
  const lastSeenAt = meaningful.length ? meaningful[meaningful.length - 1].occurred_at : null;

  // Value is evaluated only on meaningful (non-vanity) events.
  const matcher = evalMatcher(config.matcher, meaningful);
  const achievedAt =
    priorAchievedAt ?? (matcher.satisfied ? matcher.at : null);
  const achieved = !!achievedAt;

  const near = evalNearValue(config.nearValue, meaningful);

  let state: ValueState;
  let evidence: MilestoneEvidence[];

  if (achieved) {
    const days =
      lastSeenAt !== null
        ? (now.getTime() - new Date(lastSeenAt).getTime()) / DAY_MS
        : Infinity;
    state = days > config.atRiskDays ? "at_risk_after_value" : "value_achieved";
    // Prefer fresh matcher evidence; fall back to a note when only the sticky
    // prior timestamp is available (value achieved in an earlier window).
    evidence = matcher.evidence.length
      ? matcher.evidence
      : [{ at: achievedAt!, via: "sticky", detail: "Value achieved in an earlier window" }];
  } else if (meaningful.length === 0) {
    state = "not_started";
    evidence = [];
  } else if (near.progress >= NEAR_VALUE_THRESHOLD) {
    state = "near_value";
    evidence = near.evidence;
  } else {
    state = "engaged";
    evidence = near.evidence; // shows partial progress, if any
  }

  return {
    state,
    achieved,
    achievedAt,
    evidence,
    nearValueProgress: Math.round(near.progress * 100) / 100,
    meaningfulEvents: meaningful.length,
    vanityFiltered,
    lastSeenAt,
  };
}

// ── Outcome-weighted readiness ─────────────────────────────────────────────────

export type ReadinessBreakdown = {
  engagement: number; // contribution from generic engagement (capped, modest)
  value: number; // contribution from the value milestone (dominant)
  basis: ValueState;
  achieved: boolean;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Blend the generic engagement score with the value evaluation so the final
 * readiness reflects OUTCOME, not activity:
 *
 *   - generic engagement contributes at most `engagementWeight * 100` (default 40)
 *   - value achievement adds `valueBoost` (default 70) → always crosses 70
 *   - near-value adds up to `nearValueBoost` (default 25), scaled by progress
 *   - a user who only clicks around (engaged) tops out at ~40 — below threshold
 */
export function computeReadiness(
  engagementScore: number,
  evaluation: ValueEvaluation,
  config: ValueMilestoneConfig
): { readiness: number; breakdown: ReadinessBreakdown } {
  const w = config.weights;
  const engagement = clamp(engagementScore, 0, 100) * w.engagementWeight;

  let value = 0;
  if (evaluation.achieved) {
    value = w.valueBoost;
  } else if (evaluation.state === "near_value") {
    value = w.nearValueBoost * evaluation.nearValueProgress;
  }

  const readiness = Math.round(clamp(engagement + value, 0, 100));
  return {
    readiness,
    breakdown: {
      engagement: round1(engagement),
      value: round1(value),
      basis: evaluation.state,
      achieved: evaluation.achieved,
    },
  };
}

// ── Trigger gate — journey triggers depend on milestone state ──────────────────

/**
 * Whether a lifecycle email/trigger may fire given the value state. When no
 * milestone is configured this always returns true, so existing behaviour is
 * preserved (the engagement score still drives everything).
 *
 * With a milestone configured:
 *   - upgrade / urgency / limit emails wait until value is achieved,
 *   - feature-nudge / value-demo target near-value or engaged (stalled) users,
 *   - win-back targets users who slipped after value or never got there,
 *   - transactional/welcome/check-in are unaffected.
 */
export function valueAllowsTrigger(
  trigger: string,
  state: ValueState,
  configured: boolean
): boolean {
  if (!configured) return true;
  switch (trigger) {
    case "upgrade_offer":
    case "urgency":
    case "limit_upgrade":
      return state === "value_achieved" || state === "at_risk_after_value";
    case "feature_nudge":
    case "value_demo":
      return state === "engaged" || state === "near_value";
    case "churn_prevention":
      return (
        state === "at_risk_after_value" ||
        state === "near_value" ||
        state === "engaged"
      );
    default:
      return true; // welcome, check_in, daily_summary, custom …
  }
}
