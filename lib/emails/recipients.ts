/**
 * Resolves the sendable audience of a workspace: every tracked user that
 * has a real email address, together with their lifecycle stage.
 * Used by the composer's recipient dropdown and bulk sends.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { LifecycleStage } from "@/types";

export type Recipient = {
  user_id: string;
  email: string;
  stage: LifecycleStage;
};

export const AUDIENCE_STAGES: LifecycleStage[] = [
  "signup",
  "onboarding",
  "active",
  "going_quiet",
  "conversion_ready",
  "paid",
  "churned",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listRecipients(workspaceId: string): Promise<Recipient[]> {
  const supabase = createSupabaseAdminClient();

  const [{ data: stageRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("stages")
      .select("user_id, stage")
      .eq("workspace_id", workspaceId),
    supabase
      .from("events")
      .select("user_id, email")
      .eq("workspace_id", workspaceId)
      .not("user_id", "is", null)
      .not("email", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(5000),
  ]);

  const stageByUser = new Map<string, LifecycleStage>();
  for (const row of stageRows ?? []) {
    if (row.user_id && row.stage) {
      stageByUser.set(row.user_id, row.stage as LifecycleStage);
    }
  }

  // Newest event wins per user; dedupe by email so nobody gets doubles.
  const emailByUser = new Map<string, string>();
  for (const row of eventRows ?? []) {
    if (!row.user_id || !row.email) continue;
    if (!emailByUser.has(row.user_id)) {
      emailByUser.set(row.user_id, row.email.trim());
    }
  }

  const seenEmails = new Set<string>();
  const recipients: Recipient[] = [];
  for (const [userId, email] of Array.from(emailByUser.entries())) {
    const lower = email.toLowerCase();
    if (!EMAIL_RE.test(email) || lower.includes("@anon.")) continue;
    if (seenEmails.has(lower)) continue;
    seenEmails.add(lower);
    recipients.push({
      user_id: userId,
      email,
      stage: stageByUser.get(userId) ?? "signup",
    });
  }

  recipients.sort((a, b) => a.email.localeCompare(b.email));
  return recipients;
}
