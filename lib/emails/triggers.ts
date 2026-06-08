/**
 * Automated email trigger logic.
 * Called during the daily scoring cron to send the right email
 * at the right moment based on user state.
 */
import React from "react";
import { sendEmail, wasEmailSentRecently } from "./send";
import { WelcomeEmail } from "@/emails/templates/Welcome";
import { UpgradeOfferEmail } from "@/emails/templates/UpgradeOffer";
import type { EndUser, Event } from "@/types";

interface TriggerContext {
  user: EndUser;
  events: Pick<Event, "event_type" | "event_name" | "occurred_at">[];
  workspace_id: string;
}

/**
 * Evaluates all trigger conditions for a user and sends relevant emails.
 * Returns the number of emails sent.
 */
export async function triggerAutomatedEmails(
  ctx: TriggerContext
): Promise<number> {
  const { user, events, workspace_id } = ctx;
  let sent = 0;

  const now = new Date();
  const daysSinceCreated = user.created_at
    ? (now.getTime() - new Date(user.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
    : 0;
  const daysSinceLastSeen = user.last_seen_at
    ? (now.getTime() - new Date(user.last_seen_at).getTime()) /
      (1000 * 60 * 60 * 24)
    : Infinity;

  // ── Welcome email (sent once, right after signup) ──────────────────────
  if (
    daysSinceCreated < 1 &&
    !(await wasEmailSentRecently(user.id, "welcome", 48))
  ) {
    await sendEmail({
      to: user.email,
      subject: `Welcome to ${user.name ? `, ${user.name}!` : "the platform!"}`,
      react: React.createElement(WelcomeEmail, {
        userName: user.name ?? user.email,
      }),
      trigger: "welcome",
      workspaceId: workspace_id,
      endUserId: user.id,
    });
    sent++;
  }

  // ── Feature nudge (no key feature use after 5 days) ────────────────────
  if (
    daysSinceCreated >= 5 &&
    user.stage === "onboarding" &&
    !(await wasEmailSentRecently(user.id, "feature_nudge", 72))
  ) {
    const hasUsedKeyFeature = events.some(
      (e) => e.event_type === "key_feature_used"
    );
    if (!hasUsedKeyFeature) {
      // TODO: send FeatureNudgeEmail template
      sent++;
    }
  }

  // ── Value demo (3+ logins in a week) ──────────────────────────────────
  const recentLogins = events.filter(
    (e) =>
      e.event_type === "login" &&
      new Date(e.occurred_at).getTime() >
        now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).length;
  if (
    recentLogins >= 3 &&
    user.stage === "active" &&
    !(await wasEmailSentRecently(user.id, "value_demo", 168))
  ) {
    // TODO: send ValueDemoEmail template
    sent++;
  }

  // ── Check-in (10 days of silence) ─────────────────────────────────────
  if (
    daysSinceLastSeen >= 10 &&
    user.stage === "going_quiet" &&
    !(await wasEmailSentRecently(user.id, "check_in", 120))
  ) {
    // TODO: send CheckInEmail template
    sent++;
  }

  // ── Upgrade offer (score > 70) ─────────────────────────────────────────
  if (
    user.engagement_score >= 70 &&
    user.stage === "conversion_ready" &&
    !(await wasEmailSentRecently(user.id, "upgrade_offer", 48))
  ) {
    await sendEmail({
      to: user.email,
      subject: "You're ready to unlock the full platform",
      react: React.createElement(UpgradeOfferEmail, {
        userName: user.name ?? user.email,
        score: user.engagement_score,
      }),
      trigger: "upgrade_offer",
      workspaceId: workspace_id,
      endUserId: user.id,
    });
    sent++;
  }

  // ── Urgency email (pricing page visited) ──────────────────────────────
  const visitedPricing = events.some(
    (e) =>
      e.event_type === "pricing_page_visit" &&
      new Date(e.occurred_at).getTime() > now.getTime() - 24 * 60 * 60 * 1000
  );
  if (
    visitedPricing &&
    !(await wasEmailSentRecently(user.id, "urgency", 24))
  ) {
    // TODO: send UrgencyEmail template
    sent++;
  }

  // ── Churn prevention (trial ending soon, not converted) ───────────────
  const trialEndsInDays = user.trial_ends_at
    ? (new Date(user.trial_ends_at).getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
    : null;
  if (
    trialEndsInDays !== null &&
    trialEndsInDays <= 2 &&
    trialEndsInDays > 0 &&
    !user.converted_at &&
    !(await wasEmailSentRecently(user.id, "churn_prevention", 48))
  ) {
    // TODO: send ChurnPreventionEmail template
    sent++;
  }

  return sent;
}
