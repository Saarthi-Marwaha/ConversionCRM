/**
 * GET /api/cron/emails  (Vercel Cron — runs in Vercel's cloud, not your PC)
 *
 * Two daily runs so no timezone is ever skipped on the once-a-day Hobby cron:
 *   • 10:00 UTC  (default, ?mode=window)   → users in their ~11 am local window
 *     (the UTC offsets that line up with 10:00 UTC).
 *   • 08:30 UTC  (?mode=fallback)          → everyone the window run can't reach
 *     (US, India, Asia-Pacific, Middle East …), sent flat at 08:30 UTC.
 * Welcome emails are exempt from both — they fire instantly on signup.
 *
 * Schedules live in vercel.json. Protected by CRON_SECRET (Vercel attaches it).
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

  const mode =
    request.nextUrl.searchParams.get("mode") === "fallback"
      ? "fallback"
      : "window";

  const { sent: emailsSent, errors: emailErrors } = await runAutomatedEmails(mode);

  // Limit-upgrade nudges aren't region-windowed — run them once a day, on the
  // main window run only, so the fallback run doesn't double-process them.
  const { sent: limitEmailsSent, errors: limitEmailErrors } =
    mode === "window"
      ? await runLimitUpgradeEmails()
      : { sent: 0, errors: [] as string[] };

  const errors = [...emailErrors, ...limitEmailErrors];

  console.log(
    `[Cron/emails:${mode}] emails=${emailsSent} limit=${limitEmailsSent} errors=${errors.length}`
  );

  return NextResponse.json({
    ok: true,
    emailsSent,
    limitEmailsSent,
    errors: errors.slice(0, 20),
  });
}
