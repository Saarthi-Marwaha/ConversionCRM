/**
 * Nightly automated end-user emails — runs after scoring + stage assignment.
 */
import React from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail, wasEmailSentRecently } from "@/lib/emails/send";
import { WelcomeEmail } from "@/emails/templates/Welcome";
import { FeatureNudgeEmail } from "@/emails/templates/FeatureNudge";
import { ValueDemoEmail } from "@/emails/templates/ValueDemo";
import { CheckInEmail } from "@/emails/templates/CheckIn";
import { UpgradeOfferEmail } from "@/emails/templates/UpgradeOffer";
import { UrgencyEmail } from "@/emails/templates/Urgency";
import { ChurnPreventionEmail } from "@/emails/templates/ChurnPrevention";
import type { EmailTrigger } from "@/types";

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
  reply_to_email: string | null;
};

type EventRow = {
  user_id: string | null;
  email: string | null;
  event_type: string;
  page: string | null;
  occurred_at: string;
};

const HOURS = (days: number) => days * 24;

function isSignupEvent(type: string): boolean {
  return /sign[_-]?up|register/i.test(type);
}

function isPageView(type: string): boolean {
  return /page[_-]?view/i.test(type);
}

function isFeatureUsed(type: string): boolean {
  return type === "feature_used" || type === "key_feature_used";
}

function msAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function appUrlFor(ws: WorkspaceRow): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (ws.website_url) return ws.website_url.replace(/\/+$/, "");
  return configured || "https://app.conversioncrm.io";
}

function pricingUrlFor(ws: WorkspaceRow): string {
  const base = appUrlFor(ws);
  return `${base}/pricing`;
}

type UserBundle = {
  user_id: string;
  email: string;
  events: EventRow[];
  score: number;
};

async function trySend(
  opts: {
    workspace: WorkspaceRow;
    user: UserBundle;
    trigger: EmailTrigger;
    subject: string;
    react: React.ReactElement;
  },
  result: { sent: number; errors: string[] }
): Promise<void> {
  const { workspace, user, trigger, subject, react } = opts;

  if (!workspace.reply_to_email) return;

  const ok = await sendEmail({
    to: user.email,
    subject,
    react,
    trigger,
    workspaceId: workspace.id,
    userId: user.user_id,
    replyTo: workspace.reply_to_email,
    metadata: { recipient_email: user.email },
  });

  if (ok) result.sent++;
  else result.errors.push(`${workspace.id}/${user.user_id}/${trigger}`);
}

export async function runAutomatedEmails(): Promise<RunAutomatedEmailsResult> {
  const supabase = createSupabaseAdminClient();
  const result: RunAutomatedEmailsResult = { sent: 0, errors: [] };

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, name, product_name, website_url, key_feature_name, reply_to_email"
    )
    .not("reply_to_email", "is", null);

  if (wsError) {
    return { sent: 0, errors: [wsError.message] };
  }

  const now = Date.now();

  for (const ws of (workspaces ?? []) as WorkspaceRow[]) {
    if (!ws.reply_to_email?.trim()) continue;

    try {
      const { data: events, error: evError } = await supabase
        .from("events")
        .select("user_id, email, event_type, page, occurred_at")
        .eq("workspace_id", ws.id)
        .not("user_id", "is", null)
        .order("occurred_at", { ascending: false });

      if (evError) {
        result.errors.push(`workspace:${ws.id} events – ${evError.message}`);
        continue;
      }

      const [{ data: scores }, { data: stageRows }] = await Promise.all([
        supabase
          .from("engagement_scores")
          .select("user_id, score")
          .eq("workspace_id", ws.id),
        supabase
          .from("stages")
          .select("user_id, stage")
          .eq("workspace_id", ws.id),
      ]);

      const scoreByUser = new Map<string, number>();
      for (const row of scores ?? []) {
        if (row.user_id) scoreByUser.set(row.user_id, row.score ?? 0);
      }

      const stageByUser = new Map<string, string>();
      for (const row of stageRows ?? []) {
        if (row.user_id && row.stage) stageByUser.set(row.user_id, row.stage);
      }

      const byUser = new Map<string, UserBundle>();

      for (const ev of (events ?? []) as EventRow[]) {
        if (!ev.user_id) continue;

        let bundle = byUser.get(ev.user_id);
        if (!bundle) {
          bundle = {
            user_id: ev.user_id,
            email: ev.email ?? "",
            events: [],
            score: scoreByUser.get(ev.user_id) ?? 0,
          };
          byUser.set(ev.user_id, bundle);
        }

        if (!bundle.email && ev.email) bundle.email = ev.email;
        bundle.events.push(ev);
      }

      const productName = ws.product_name ?? ws.name;
      const appUrl = appUrlFor(ws);
      const pricingUrl = pricingUrlFor(ws);
      const keyFeature = ws.key_feature_name ?? "the key feature";

      for (const user of Array.from(byUser.values())) {
        if (!user.email || user.email.includes("@anon.")) continue;
        if (stageByUser.get(user.user_id) === "paid") continue;

        const displayName = user.email.split("@")[0] || user.email;
        const evts = user.events;

        const hasSignup = evts.some((e) => isSignupEvent(e.event_type));
        const lastEventMs = evts.length
          ? Math.max(...evts.map((e) => new Date(e.occurred_at).getTime()))
          : 0;

        const featureUsedIn5d = evts.some(
          (e) =>
            isFeatureUsed(e.event_type) &&
            new Date(e.occurred_at).getTime() >= msAgo(5)
        );

        const pageViews7d = evts.filter(
          (e) =>
            isPageView(e.event_type) &&
            new Date(e.occurred_at).getTime() >= msAgo(7)
        ).length;

        const pricingPageView24h = evts.some(
          (e) =>
            isPageView(e.event_type) &&
            (e.page?.toLowerCase().includes("pricing") ?? false) &&
            new Date(e.occurred_at).getTime() >= now - 24 * 60 * 60 * 1000
        );

        // ── Welcome: signup event, never sent before ─────────────────────
        if (
          hasSignup &&
          !(await wasEmailSentRecently(ws.id, user.user_id, "welcome", null))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "welcome",
              subject: `Welcome to ${productName}`,
              react: React.createElement(WelcomeEmail, {
                userName: displayName,
                appUrl,
                productName,
              }),
            },
            result
          );
        }

        // ── Feature nudge: no feature_used in 5d, no nudge in 5d ─────────
        if (
          !featureUsedIn5d &&
          !(await wasEmailSentRecently(
            ws.id,
            user.user_id,
            "feature_nudge",
            HOURS(5)
          ))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "feature_nudge",
              subject: `Try ${keyFeature} in ${productName}`,
              react: React.createElement(FeatureNudgeEmail, {
                userName: displayName,
                keyFeatureName: keyFeature,
                appUrl,
                productName,
              }),
            },
            result
          );
        }

        // ── Value demo: 3+ page views in 7d, no value demo in 7d ──────────
        if (
          pageViews7d >= 3 &&
          !(await wasEmailSentRecently(
            ws.id,
            user.user_id,
            "value_demo",
            HOURS(7)
          ))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "value_demo",
              subject: `You're exploring ${productName} — nice work`,
              react: React.createElement(ValueDemoEmail, {
                userName: displayName,
                appUrl,
                productName,
              }),
            },
            result
          );
        }

        // ── Check-in: no events in 10d, no check-in in 10d ───────────────
        if (
          lastEventMs > 0 &&
          lastEventMs < msAgo(10) &&
          !(await wasEmailSentRecently(
            ws.id,
            user.user_id,
            "check_in",
            HOURS(10)
          ))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "check_in",
              subject: `Checking in on your ${productName} account`,
              react: React.createElement(CheckInEmail, {
                userName: displayName,
                appUrl,
                productName,
              }),
            },
            result
          );
        }

        // ── Upgrade offer: score > 70, no offer in 7d ────────────────────
        if (
          user.score > 70 &&
          !(await wasEmailSentRecently(
            ws.id,
            user.user_id,
            "upgrade_offer",
            HOURS(7)
          ))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "upgrade_offer",
              subject: `You're ready to upgrade ${productName}`,
              react: React.createElement(UpgradeOfferEmail, {
                userName: displayName,
                score: user.score,
                checkoutUrl: pricingUrl,
                appUrl,
                productName,
              }),
            },
            result
          );
        }

        // ── Urgency: pricing page_view in 24h, no urgency in 24h ─────────
        if (
          pricingPageView24h &&
          !(await wasEmailSentRecently(
            ws.id,
            user.user_id,
            "urgency",
            24
          ))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "urgency",
              subject: `Questions about ${productName} pricing?`,
              react: React.createElement(UrgencyEmail, {
                userName: displayName,
                pricingUrl,
                productName,
              }),
            },
            result
          );
        }

        // ── Churn prevention: no events in 25d, no churn email in 25d ────
        if (
          lastEventMs > 0 &&
          lastEventMs < msAgo(25) &&
          !(await wasEmailSentRecently(
            ws.id,
            user.user_id,
            "churn_prevention",
            HOURS(25)
          ))
        ) {
          await trySend(
            {
              workspace: ws,
              user,
              trigger: "churn_prevention",
              subject: `We'd love to see you back on ${productName}`,
              react: React.createElement(ChurnPreventionEmail, {
                userName: displayName,
                appUrl,
                productName,
              }),
            },
            result
          );
        }
      }
    } catch (err) {
      result.errors.push(`workspace:${ws.id} – ${String(err)}`);
    }
  }

  return result;
}
