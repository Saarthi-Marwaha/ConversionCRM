/**
 * Runnable tests for the value-milestone engine. The TS module is compiled to
 * .tmp-vm/value-milestone.js first (see the npm-less runner in the commit
 * message / summary): tsc lib/value-milestone.ts --outDir .tmp-vm --rootDir lib
 */
import {
  normalizeMilestoneConfig,
  evaluateValue,
  computeReadiness,
  valueAllowsTrigger,
  READINESS_THRESHOLD,
} from "../.tmp-vm/value-milestone.js";

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) pass++;
  else {
    fail++;
    console.error("  ✗ FAIL:", name);
  }
}
const eq = (name, a, b) => ok(`${name} → got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`, a === b);

const ev = (type, at, props = null) => ({ event_type: type, occurred_at: at, properties: props });
const NOW = new Date("2026-06-20T00:00:00Z");
const day = (d) => `2026-06-${String(d).padStart(2, "0")}T12:00:00Z`;

const baseCfg = (over = {}) =>
  normalizeMilestoneConfig({
    enabled: true,
    label: "First project created",
    matcher: { kind: "event", event: "project_created" },
    nearValue: [],
    vanityEvents: ["click", "page_view", "time_spent"],
    ...over,
  });

// ── 1. Milestone configured correctly ─────────────────────────────────────────
{
  const c = baseCfg();
  ok("1. config normalises", c !== null);
  eq("1. default valueBoost", c.weights.valueBoost, 75);
  eq("1. default engagementWeight", c.weights.engagementWeight, 0.4);
  eq("1. vanity lowercased", c.vanityEvents.includes("click"), true);
  ok("1. disabled → null", normalizeMilestoneConfig({ enabled: false, matcher: { kind: "event", event: "x" } }) === null);
  ok("1. no matcher → null", normalizeMilestoneConfig({ enabled: true }) === null);
}

// ── 2. Milestone event received → value achieved ──────────────────────────────
{
  const c = baseCfg();
  const events = [ev("page_view", day(10)), ev("project_created", day(11))];
  const e = evaluateValue(c, events, NOW);
  eq("2. achieved", e.achieved, true);
  eq("2. state", e.state, "value_achieved");
  eq("2. achievedAt is the event time", e.achievedAt, day(11));
  ok("2. has audit evidence", e.evidence.length > 0 && /project_created/.test(e.evidence[0].detail));
}

// ── 3. Computed (all) condition satisfied ─────────────────────────────────────
{
  const c = baseCfg({
    matcher: { kind: "all", of: [{ kind: "event", event: "integration_connected" }, { kind: "event", event: "report_generated" }] },
  });
  // Only one of two → NOT achieved
  const partial = evaluateValue(c, [ev("integration_connected", day(10))], NOW);
  eq("3. partial computed → not achieved", partial.achieved, false);
  // Both → achieved, achievedAt = the later one (when the last condition completed)
  const full = evaluateValue(c, [ev("integration_connected", day(10)), ev("report_generated", day(12))], NOW);
  eq("3. full computed → achieved", full.achieved, true);
  eq("3. computed achievedAt = last condition", full.achievedAt, day(12));
  eq("3. evidence covers both", full.evidence.length, 2);

  // count matcher
  const cc = baseCfg({ matcher: { kind: "count", event: "transaction", atLeast: 2 } });
  eq("3. count below → not achieved", evaluateValue(cc, [ev("transaction", day(9))], NOW).achieved, false);
  const two = evaluateValue(cc, [ev("transaction", day(9)), ev("transaction", day(11))], NOW);
  eq("3. count met → achieved at Nth", two.achievedAt, day(11));

  // property matcher
  const cp = baseCfg({ matcher: { kind: "property", event: "checkout", property: "status", equals: "success" } });
  eq("3. property mismatch → not achieved", evaluateValue(cp, [ev("checkout", day(9), { status: "failed" })], NOW).achieved, false);
  eq("3. property match → achieved", evaluateValue(cp, [ev("checkout", day(9), { status: "success" })], NOW).achieved, true);
}

// ── 4. Engaged user WITHOUT value is not over-scored ──────────────────────────
{
  const c = baseCfg();
  // Lots of vanity activity + one non-value meaningful event, never the milestone.
  const events = [];
  for (let d = 1; d <= 12; d++) events.push(ev("click", day(d)), ev("page_view", day(d)));
  events.push(ev("settings_opened", day(12))); // meaningful but not value
  const e = evaluateValue(c, events, NOW);
  ok("4. not achieved despite heavy activity", e.achieved === false);
  ok("4. vanity filtered out", e.vanityFiltered === 24);
  eq("4. state engaged (not value)", e.state, "engaged");
  // Even with a maxed engagement score, readiness must stay below threshold.
  const { readiness } = computeReadiness(100, e, c);
  ok(`4. readiness ${readiness} below threshold ${READINESS_THRESHOLD}`, readiness < READINESS_THRESHOLD);
  ok("4. readiness capped near engagementWeight*100 (≈40)", readiness <= 40);
}

// ── 5. Value-achieved user gets proper state + readiness ──────────────────────
{
  const c = baseCfg();
  const e = evaluateValue(c, [ev("project_created", day(18)), ev("page_view", day(18))], NOW);
  eq("5. value_achieved state", e.state, "value_achieved");
  const low = computeReadiness(5, e, c).readiness; // low engagement, but value achieved
  ok(`5. readiness ${low} still ≥ threshold on value`, low >= READINESS_THRESHOLD);
  const high = computeReadiness(90, e, c).readiness;
  ok("5. readiness ≤ 100", high <= 100);
}

// ── 6. Trigger fires only after the value line is crossed ─────────────────────
{
  ok("6. upgrade blocked when engaged", valueAllowsTrigger("upgrade_offer", "engaged", true) === false);
  ok("6. upgrade blocked when near_value", valueAllowsTrigger("upgrade_offer", "near_value", true) === false);
  ok("6. upgrade allowed when value_achieved", valueAllowsTrigger("upgrade_offer", "value_achieved", true) === true);
  ok("6. upgrade allowed when at_risk_after_value", valueAllowsTrigger("upgrade_offer", "at_risk_after_value", true) === true);
  ok("6. feature_nudge targets near/engaged", valueAllowsTrigger("feature_nudge", "near_value", true) === true);
  ok("6. feature_nudge not sent to achieved", valueAllowsTrigger("feature_nudge", "value_achieved", true) === false);
  ok("6. unconfigured → backward compatible (always allow)", valueAllowsTrigger("upgrade_offer", "engaged", false) === true);
  ok("6. welcome always allowed", valueAllowsTrigger("welcome", "not_started", true) === true);
}

// ── 7. Near-value heuristics (close but stalled) ──────────────────────────────
{
  const c = baseCfg({
    matcher: { kind: "event", event: "workflow_completed" },
    nearValue: [
      { kind: "prerequisites", events: ["step_a", "step_b", "step_c"], fraction: 0.8 },
      { kind: "reached_event", event: "integration_connected" },
    ],
  });
  // Connected the integration but never completed the outcome → near_value
  const near = evaluateValue(c, [ev("integration_connected", day(12)), ev("step_a", day(12))], NOW);
  eq("7. near_value state", near.state, "near_value");
  ok("7. near progress recorded", near.nearValueProgress >= 0.6);
  // Only 1/3 prerequisites and no integration → engaged, not near
  const eng = evaluateValue(c, [ev("step_a", day(12))], NOW);
  eq("7. one prereq → engaged", eng.state, "engaged");
}

// ── 8. At-risk after value (valuable but not retained) ────────────────────────
{
  const c = baseCfg({ atRiskDays: 14 });
  // Achieved long ago, no activity since → at_risk_after_value
  const e = evaluateValue(c, [ev("project_created", day(1)), ev("page_view", day(2))], NOW);
  eq("8. at_risk_after_value", e.state, "at_risk_after_value");
  eq("8. still counts as achieved", e.achieved, true);
  // Readiness stays high (they got value) so they remain a conversion target.
  ok("8. readiness stays high", computeReadiness(10, e, c).readiness >= READINESS_THRESHOLD);
}

// ── 9. Sticky achievement + not_started + audit ───────────────────────────────
{
  const c = baseCfg();
  // No value event in this window, but a prior achievement is passed in → sticky
  const sticky = evaluateValue(c, [ev("page_view", day(18))], NOW, day(2));
  eq("9. sticky stays achieved", sticky.achieved, true);
  ok("9. sticky keeps prior timestamp", sticky.achievedAt === day(2));
  // Vanity-only events → not_started (no meaningful activity)
  const idle = evaluateValue(c, [ev("click", day(10)), ev("page_view", day(10))], NOW);
  eq("9. vanity-only → not_started", idle.state, "not_started");
  eq("9. no meaningful events", idle.meaningfulEvents, 0);
}

// ── 10. End-to-end: readiness → lifecycle stage (mirrors assign-stages) ───────
// resolveStage in lib/cron/assign-stages.ts: score>=71 conversion_ready,
// >=31 active, >=1 onboarding. Prove value crosses it and activity doesn't.
{
  const stageFromScore = (s) => (s >= 71 ? "conversion_ready" : s >= 31 ? "active" : s >= 1 ? "onboarding" : "signup");
  const c = baseCfg();

  // Heavy clicker, never the value event → must NOT be conversion_ready.
  const clicker = [];
  for (let d = 1; d <= 12; d++) clicker.push(ev("click", day(d)), ev("page_view", day(d)), ev("settings_opened", day(d)));
  const clickerEval = evaluateValue(c, clicker, NOW);
  const clickerReadiness = computeReadiness(100, clickerEval, c).readiness;
  ok(`10. clicker stays out of conversion_ready (stage=${stageFromScore(clickerReadiness)})`, stageFromScore(clickerReadiness) !== "conversion_ready");

  // Value achiever (even with modest engagement) → conversion_ready immediately.
  const achiever = [ev("page_view", day(18)), ev("project_created", day(18))];
  const achieverEval = evaluateValue(c, achiever, NOW);
  const achieverReadiness = computeReadiness(20, achieverEval, c).readiness;
  eq("10. value achiever → conversion_ready", stageFromScore(achieverReadiness), "conversion_ready");
  // Worst case: value achieved, zero engagement → still clears 71.
  eq("10. value+zero-engagement still conversion_ready", stageFromScore(computeReadiness(0, achieverEval, c).readiness), "conversion_ready");
}

console.log(`\nvalue-milestone: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
