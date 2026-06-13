/**
 * GET /api/emails/recipients
 *
 * Audience counts for the composer's Send-to dropdown (total + per stage).
 * Individual emails are intentionally not exposed here — the composer's
 * Individual option takes a typed address instead.
 */
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { listRecipients, AUDIENCE_STAGES } from "@/lib/emails/recipients";

export const dynamic = "force-dynamic";

export async function GET() {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const recipients = await listRecipients(workspace.id);

  const stageCounts: Record<string, number> = {};
  for (const stage of AUDIENCE_STAGES) stageCounts[stage] = 0;
  for (const r of recipients) {
    stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1;
  }

  return NextResponse.json({
    total: recipients.length,
    stageCounts,
  });
}
