/**
 * Nightly automated end-user emails — runs after scoring + stage assignment.
 *
 * One email per user per night, chosen from their current row in `stages`.
 */
import React from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  sendEmail,
  wasEmailSentRecently,
  countEmailsSentToUser,
} from "@/lib/emails/send";
import { isWithinSendWindow, isCoveredByWindowRun } from "@/lib/emails/local-time";

/**
 * "window"   — the daily 10:00 UTC run: send only to users inside their
 *              10:00–12:59 local window (a few UTC offsets line up).
 * "fallback" — the daily 08:30 UTC run: send to everyone the window run can't
 *              reach (US, India, Asia-Pacific, the Middle East, …), at a flat
 *              08:30 UTC, so no region is ever skipped.
 */
export type EmailRunMode = "window" | "fallback";
import { matchesAhaUrl, normalizeAhaPath } from "@/lib/scoring";
import {
  normalizeMilestoneConfig,
  valueAllowsTrigger,
  type ValueState,
} from "@/lib/value-milestone";
import { WelcomeEmail } from "@/emails/templates/Welcome";
import { FeatureNudgeEmail } from "@/emails/templates/FeatureNudge";
import { ValueDemoEmail } from "@/emails/templates/ValueDemo";
import { CheckInEmail } from "@/emails/templates/CheckIn";
import { UpgradeOfferEmail } from "@/emails/templates/UpgradeOffer";
import { UrgencyEmail } from "@/emails/templates/Urgency";
import { ChurnPreventionEmail } from "@/emails/templates/ChurnPrevention";
import type { EmailTrigger, LifecycleStage } from "@/types";

export type RunAutomatedEmailsResult = {
  sent: number;
  errors: string[];
};

type WorkspaceRow = {
  id: string;
  name: string;
  product_name: string | null;
  website_url: string | null;
  key_feature_name: string | null;
  key_feature_event: string | null;
  key_feature_url: string | null;
  reply_to_email: string | null;
  email_sender_name: string | null;
  plan: string | null;
  followup_enabled: boolean | null;
  followup_interval_days: number | null;
  followup_max_sends: number | null;
  value_milestone: unknown;
};

/**
 * The repeating "follow-up" nudges. While a user stays in a non-converted
 * stage and keeps not acting, these re-send every `followup_interval_days`
 * (configurable, default 7) up to `followup_max_sends`. They stop the moment
 * the user converts/upgrades (→ paid stage, no email) or takes the desired
 * action (→ stage advances), because stage assignment is behaviour-based.
 */
const NUDGE_TRIGGERS: ReadonlySet<EmailTrigger> = new Set<EmailTrigger>([
  "feature_nudge",
  "value_demo",
  "check_in",
  "upgrade_offer",
]);

type EventRow = {
  user_id: string | null;
  email: string | null;
  event_type: string;
  page: string | null;
  country: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

type StageRow = {
  user_id: string;
  stage: LifecycleStage;
};

/** Cooldown windows per trigger (hours). `null` = only send if never sent before. */
const COOLDOWN_HOURS: Record<EmailTrigger, number | null> = {
  welcome: null,
  feature_nudge: 5 * 24,
  value_demo: 7 * 24,
  check_in: 10 * 24,
  upgrade_offer: 7 * 24,
  urgency: 24,
  churn_prevention: 25 * 24,
  limit_upgrade: 7 * 24,
  daily_summary: 24,
  custom: 0,
};

function isPageView(type: string): boolean {
  return /page[_-]?view/i.test(type);
}

function isFeatureUsed(type: string): boolean {
  return type === "feature_used" || type === "key_feature_used";
}

function isPricingVisit(ev: EventRow): boolean {
  if (ev.event_type === "pricing_page_visit") return true;
  return (
    isPageView(ev.event_type) &&
    (ev.page?.toLowerCase().includes("pricing") ?? false)
  );
}

function msAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function appUrlFor(ws: WorkspaceRow): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (ws.website_url) return ws.website_url.replace(/\/+$/, "");
  return configured || "https://www.conversioncrm.co";
}

function pricingUrlFor(ws: WorkspaceRow): string {
  return `${appUrlFor(ws)}/pricing`;
}

function resolveEmail(events: EventRow[]): string | null {
  for (const ev of events) {
    if (ev.email?.trim()) return ev.email.trim();
    const props = ev.properties ?? {};
    const fromProps = props.email;
    if (typeof fromProps === "string" && fromProps.trim()) {
      return fromProps.trim();
    }
  }
  return null;
}

type UserContext = {
  user_id: string;
  email: string;
  stage: LifecycleStage;
  events: EventRow[];
  score: number;
};

type EmailPlan = {
  trigger: EmailTrigger;
  subject: string;
  react: React.ReactElement;
};

/**
 * Pick the single email for tonight based on lifecycle stage.
 * Returns null when no email should be sent for this user tonight.
 */
export function planStageEmail(
  user: UserContext,
  ws: WorkspaceRow
): EmailPlan | null {
  const productName = ws.product_name ?? ws.name;
  const appUrl = appUrlFor(ws);
  const pricingUrl = pricingUrlFor(ws);
  const keyFeature = ws.key_feature_name ?? "the key feature";
  const displayName = user.email.split("@")[0] || user.email;
  const evts = user.events;

  switch (user.stage) {
    case "paid":
      return null;

    case "signup":
      return {
        trigger: "welcome",
        subject: `You're in — here's what happens in the next 48 hours`,
        react: React.createElement(WelcomeEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };

    case "onboarding": {
      const ahaEvent = ws.key_feature_event?.trim().toLowerCase() || null;
      const ahaPath = normalizeAhaPath(ws.key_feature_url);
      const featureUsedIn5d = evts.some(
        (e) =>
          (isFeatureUsed(e.event_type) ||
            (ahaEvent !== null && e.event_type.toLowerCase() === ahaEvent) ||
            matchesAhaUrl(e, ahaPath)) &&
          new Date(e.occurred_at).getTime() >= msAgo(5)
      );
      if (featureUsedIn5d) return null;
      return {
        trigger: "feature_nudge",
        subject: `The one thing that makes ${productName} click — have you tried it?`,
        react: React.createElement(FeatureNudgeEmail, {
          userName: displayName,
          keyFeatureName: keyFeature,
          appUrl,
          productName,
        }),
      };
    }

    case "active": {
      const pageViews7d = evts.filter(
        (e) =>
          isPageView(e.event_type) &&
          new Date(e.occurred_at).getTime() >= msAgo(7)
      ).length;
      if (pageViews7d < 3) return null;
      return {
        trigger: "value_demo",
        subject: `Here's what ${productName} already knows about your users`,
        react: React.createElement(ValueDemoEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };
    }

    case "going_quiet":
      return {
        trigger: "check_in",
        subject: `Quick question — what got in the way?`,
        react: React.createElement(CheckInEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };

    case "conversion_ready": {
      const visitedPricing = evts.some((e) => isPricingVisit(e));
      if (visitedPricing) {
        return {
          trigger: "urgency",
          subject: `You looked at pricing — let me answer any questions`,
          react: React.createElement(UrgencyEmail, {
            userName: displayName,
            pricingUrl,
            productName,
          }),
        };
      }
      return {
        trigger: "upgrade_offer",
        subject: `Your engagement score hit ${user.score}/100 — you're ready to upgrade`,
        react: React.createElement(UpgradeOfferEmail, {
          userName: displayName,
          score: user.score,
          checkoutUrl: pricingUrl,
          appUrl,
          productName,
        }),
      };
    }

    case "churned":
      return {
        trigger: "churn_prevention",
        subject: `Before you go — 30 seconds?`,
        react: React.createElement(ChurnPreventionEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };

    default:
      return null;
  }
}

// Batches run up to once an hour so each region hits its own ~11 am send
// window; per-trigger cooldowns stop users from getting repeats.
const BATCH_COOLDOWN_MS = 50 * 60 * 1000;

export function shouldRunEmailBatch(
  emailsLastRunAt: string | null | undefined
): boolean {
  if (!emailsLastRunAt) return true;
  return Date.now() - new Date(emailsLastRunAt).getTime() >= BATCH_COOLDOWN_MS;
}

async function processWorkspaceEmails(
  ws: WorkspaceRow,
  result: RunAutomatedEmailsResult,
  mode: EmailRunMode = "window"
): Promise<void> {
  // The 8 behaviour-triggered lifecycle emails run on EVERY plan, including
  // Free — the monthly quota in sendEmail() is what bounds volume per tier.
  const supabase = createSupabaseAdminClient();

  const [
    { data: stageRows, error: stageError },
    { data: events, error: evError },
    { data: scores },
  ] = await Promise.all([
        supabase
          .from("stages")
          .select("user_id, stage")
          .eq("workspace_id", ws.id),
        supabase
          .from("events")
          .select(
            "user_id, email, event_type, page, country, properties, occurred_at"
          )
          .eq("workspace_id", ws.id)
          .not("user_id", "is", null)
          .order("occurred_at", { ascending: false })
          .limit(5000),
        supabase
          .from("engagement_scores")
          .select("user_id, score, value_state")
          .eq("workspace_id", ws.id),
  ]);

  // Value milestone gate: when configured, lifecycle triggers fire on value
  // STATE, not just the engagement score. Unconfigured → null → no gating.
  const milestone = normalizeMilestoneConfig(ws.value_milestone);
  const valueStateByUser = new Map<string, ValueState>();

  if (stageError) {
    result.errors.push(`workspace:${ws.id} stages – ${stageError.message}`);
    return;
  }
  if (evError) {
    result.errors.push(`workspace:${ws.id} events – ${evError.message}`);
    return;
  }

  const scoreByUser = new Map<string, number>();
  for (const row of (scores ?? []) as {
    user_id: string | null;
    score: number | null;
    value_state: ValueState | null;
  }[]) {
    if (!row.user_id) continue;
    scoreByUser.set(row.user_id, row.score ?? 0);
    if (row.value_state) valueStateByUser.set(row.user_id, row.value_state);
  }

  const eventsByUser = new Map<string, EventRow[]>();
  for (const ev of (events ?? []) as EventRow[]) {
    if (!ev.user_id) continue;
    const list = eventsByUser.get(ev.user_id) ?? [];
    list.push(ev);
    eventsByUser.set(ev.user_id, list);
  }

  for (const row of (stageRows ?? []) as StageRow[]) {
    const userEvents = eventsByUser.get(row.user_id) ?? [];
    const email = resolveEmail(userEvents);
    if (!email || email.includes("@anon.")) continue;

    const user: UserContext = {
      user_id: row.user_id,
      email,
      stage: row.stage,
      events: userEvents,
      score: scoreByUser.get(row.user_id) ?? 0,
    };

    const plan = planStageEmail(user, ws);
    if (!plan) continue;

    // ── Value milestone gate ───────────────────────────────────────────
    // When a milestone is configured, journey triggers depend on the value
    // STATE: upgrade/urgency wait until value is achieved, nudges target
    // near-value/engaged users. No milestone → always allowed (unchanged).
    if (
      milestone &&
      !valueAllowsTrigger(
        plan.trigger,
        valueStateByUser.get(user.user_id) ?? "not_started",
        true
      )
    ) {
      continue;
    }

    // Region-aware timing (welcome is exempt — it fires instantly on signup).
    //  • window run   → only users in their ~11 am local window.
    //  • fallback run → only users the window run can't reach (sent flat at
    //    the fallback hour, 08:30 UTC), so no timezone is ever skipped.
    if (plan.trigger !== "welcome") {
      const country = userEvents.find((e) => e.country)?.country ?? null;
      if (mode === "fallback") {
        if (isCoveredByWindowRun(country)) continue;
      } else if (!isWithinSendWindow(country)) {
        continue;
      }
    }

    // ── Persistent follow-up cadence + guardrails ──────────────────────
    // The repeating nudges re-send every `followup_interval_days` (default 7)
    // while the user stays in this non-converted stage and keeps not acting —
    // capped at `followup_max_sends` so they can never spam. Other triggers
    // keep their built-in cooldowns. Stop conditions (convert / upgrade / paid
    // / took the desired action) are handled upstream by stage assignment.
    const isNudge = NUDGE_TRIGGERS.has(plan.trigger);
    const intervalDays = ws.followup_interval_days ?? 7;
    const cooldown = isNudge
      ? intervalDays * 24
      : COOLDOWN_HOURS[plan.trigger];

    if (
      await wasEmailSentRecently(ws.id, user.user_id, plan.trigger, cooldown)
    ) {
      continue;
    }

    if (isNudge) {
      // followup_enabled=false → send the nudge once, then stop following up.
      const maxSends =
        ws.followup_enabled === false ? 1 : ws.followup_max_sends ?? 4;
      const alreadySent = await countEmailsSentToUser(
        ws.id,
        user.user_id,
        plan.trigger
      );
      if (alreadySent >= maxSends) continue;
    }

    const ok = await sendEmail({
      to: user.email,
      subject: plan.subject,
      react: plan.react,
      trigger: plan.trigger,
      workspaceId: ws.id,
      userId: user.user_id,
      replyTo: ws.reply_to_email,
      workspace: ws,
      metadata: {
        recipient_email: user.email,
        stage: user.stage,
      },
    });

    if (ok) {
      result.sent++;
    } else {
      result.errors.push(`${ws.id}/${user.user_id}/${plan.trigger}`);
    }
  }
}

export async function runAutomatedEmailsForWorkspace(
  workspaceId: string
): Promise<RunAutomatedEmailsResult> {
  const supabase = createSupabaseAdminClient();
  const result: RunAutomatedEmailsResult = { sent: 0, errors: [] };

  const { data: ws, error } = await supabase
    .from("workspaces")
    .select(
      "id, name, product_name, website_url, key_feature_name, key_feature_event, key_feature_url, reply_to_email, email_sender_name, plan, followup_enabled, followup_interval_days, followup_max_sends, value_milestone, emails_last_run_at"
    )
    .eq("id", workspaceId)
    .single();

  if (error || !ws) {
    result.errors.push(error?.message ?? "workspace not found");
    return result;
  }

  const workspace = ws as WorkspaceRow & { emails_last_run_at?: string | null };
  if (!workspace.reply_to_email?.trim()) {
    return result;
  }

  if (!shouldRunEmailBatch(workspace.emails_last_run_at)) {
    return result;
  }

  try {
    await processWorkspaceEmails(workspace, result);
    // Stamp batch time when sends succeeded or everyone was already caught up.
    if (result.sent > 0 || result.errors.length === 0) {
      await supabase
        .from("workspaces")
        .update({ emails_last_run_at: new Date().toISOString() })
        .eq("id", workspaceId);
    }
  } catch (err) {
    result.errors.push(`workspace:${workspaceId} – ${String(err)}`);
  }

  return result;
}

export async function runAutomatedEmails(
  mode: EmailRunMode = "window"
): Promise<RunAutomatedEmailsResult> {
  const supabase = createSupabaseAdminClient();
  const result: RunAutomatedEmailsResult = { sent: 0, errors: [] };

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, name, product_name, website_url, key_feature_name, key_feature_event, key_feature_url, reply_to_email, email_sender_name, plan, followup_enabled, followup_interval_days, followup_max_sends, value_milestone"
    )
    .not("reply_to_email", "is", null);

  if (wsError) {
    return { sent: 0, errors: [wsError.message] };
  }

  for (const ws of (workspaces ?? []) as WorkspaceRow[]) {
    if (!ws.reply_to_email?.trim()) continue;
    try {
      await processWorkspaceEmails(ws, result, mode);
    } catch (err) {
      result.errors.push(`workspace:${ws.id} – ${String(err)}`);
    }
  }

  return result;
}
