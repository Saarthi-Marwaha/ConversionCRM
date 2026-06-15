/**
 * Feedback portal API — feature suggestions and issue reports.
 *
 * GET  → this workspace's submissions (newest first)
 * POST → { kind: 'feature' | 'issue', message }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/emails/notify-owner";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  kind: z.enum(["feature", "issue"]),
  message: z.string().trim().min(3).max(2000),
  company: z.string().trim().max(120).optional(),
});

// Light per-instance limit: 10 submissions per workspace per hour.
const submissions = new Map<string, number[]>();

export async function GET() {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("id, kind, message, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { workspace, userEmail } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Write a few words first (max 2000 characters)." },
      { status: 400 }
    );
  }

  const now = Date.now();
  const recent = (submissions.get(workspace.id) ?? []).filter(
    (t) => now - t < 60 * 60 * 1000
  );
  if (recent.length >= 10) {
    return NextResponse.json(
      { error: "That's a lot of feedback — take a breather and try again soon." },
      { status: 429 }
    );
  }
  recent.push(now);
  submissions.set(workspace.id, recent);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feedback")
    .insert({
      workspace_id: workspace.id,
      author_email: userEmail || null,
      kind: parsed.data.kind,
      message: parsed.data.message,
    })
    .select("id, kind, message, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget team notification, subject-marked bug/feature.
  void notifyOwner({
    type: parsed.data.kind === "feature" ? "Feature request" : "Bug report",
    workspaceName: workspace.name,
    companyName: parsed.data.company || workspace.name,
    fromEmail: userEmail || workspace.reply_to_email,
    content: parsed.data.message,
  });

  return NextResponse.json({ ok: true, item: data });
}
