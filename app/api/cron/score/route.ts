/**
 * GET /api/cron/score
 *
 * Vercel Cron job: runs daily to recompute engagement scores for all users,
 * update lifecycle stages, and trigger automated emails based on new state.
 *
 * Cron schedule (vercel.json): "0 8 * * *"  (08:00 UTC daily)
 * Protected by CRON_SECRET in the Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { computeEngagementScore, determineStage } from "@/lib/scoring";
import { updateEndUserScore, getRecentEventsForUser } from "@/db/queries";
import { validateCronSecret } from "@/lib/utils";
import { triggerAutomatedEmails } from "@/lib/emails/triggers";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min max for Vercel Pro

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch all active (non-paid, non-churned) end users across all workspaces
  const { data: users, error } = await supabase
    .from("end_users")
    .select("*")
    .not("stage", "in", '("paid","churned")')
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("[Cron/score] Failed to fetch users:", error);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  let scored = 0;
  let emailed = 0;
  const errors: string[] = [];

  for (const user of users ?? []) {
    try {
      const events = await getRecentEventsForUser(user.id, 14);
      const { score, breakdown } = computeEngagementScore(events);
      const newStage = determineStage(user, score, events);

      await updateEndUserScore(user.id, score, newStage);

      // Persist score snapshot
      await supabase.from("engagement_scores").insert({
        workspace_id: user.workspace_id,
        end_user_id: user.id,
        score,
        score_breakdown: breakdown,
      });

      const emailsSent = await triggerAutomatedEmails({
        user: { ...user, engagement_score: score, stage: newStage },
        events,
        workspace_id: user.workspace_id,
      });

      emailed += emailsSent;
      scored++;
    } catch (err) {
      errors.push(`user:${user.id} – ${String(err)}`);
    }
  }

  console.log(`[Cron/score] scored=${scored} emailed=${emailed} errors=${errors.length}`);

  return NextResponse.json({
    ok: true,
    scored,
    emailed,
    errors: errors.slice(0, 10), // cap to avoid huge response
  });
}
