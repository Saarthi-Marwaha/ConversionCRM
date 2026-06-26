/**
 * POST/GET /api/cron/backfill-value
 *
 * One-off (re-runnable) backfill of value_state / value_achieved_at from each
 * user's full event history. Protected by CRON_SECRET. Run once after a
 * workspace configures a value milestone so historical achievers are detected
 * immediately instead of waiting for the next time they re-cross the line.
 */
import { NextRequest, NextResponse } from "next/server";
import { backfillValueMilestones } from "@/lib/cron/backfill-value-milestones";
import { validateCronSecret } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await backfillValueMilestones();
  console.log(
    `[Cron/backfill-value] workspaces=${result.workspacesProcessed} users=${result.usersUpdated} errors=${result.errors.length}`
  );
  return NextResponse.json({ ok: true, ...result, errors: result.errors.slice(0, 20) });
}

export const GET = run;
export const POST = run;
