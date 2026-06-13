/**
 * GET /api/cron/emails
 *
 * Vercel Cron job: runs hourly. Each run sends lifecycle emails only to
 * users whose local time (from their captured country) is mid-morning
 * (~11 am), so every region gets its emails at a human hour instead of
 * midnight UTC. Welcome emails are exempt — those go out instantly when
 * the signup event arrives.
 *
 * Cron schedule (vercel.json): "0 * * * *"
 * Protected by CRON_SECRET in the Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { runAutomatedEmails } from "@/lib/cron/run-automated-emails";
import { runLimitUpgradeEmails } from "@/lib/cron/run-limit-upgrade-emails";
import { validateCronSecret } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sent: emailsSent, errors: emailErrors } = await runAutomatedEmails();
  const { sent: limitEmailsSent, errors: limitEmailErrors } =
    await runLimitUpgradeEmails();

  const errors = [...emailErrors, ...limitEmailErrors];

  console.log(
    `[Cron/emails] emails=${emailsSent} limit=${limitEmailsSent} errors=${errors.length}`
  );

  return NextResponse.json({
    ok: true,
    emailsSent,
    limitEmailsSent,
    errors: errors.slice(0, 20),
  });
}
