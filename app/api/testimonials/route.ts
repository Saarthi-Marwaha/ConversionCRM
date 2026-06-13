/**
 * Testimonials API — permanent, shared praise wall.
 *
 * GET  → every testimonial ever written (newest first), visible to all
 * POST → { author_name?, rating: 1–5, content } — write-once, no deletes
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/emails/notify-owner";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  author_name: z.string().trim().max(80).optional(),
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(3).max(1500),
});

// One testimonial per workspace per 5 minutes (per instance).
const lastPost = new Map<string, number>();

export async function GET() {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("id, author_name, rating, content, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = data ?? [];
  const average =
    items.length > 0
      ? Math.round(
          (items.reduce((s, t) => s + (t.rating ?? 0), 0) / items.length) * 10
        ) / 10
      : null;

  return NextResponse.json({ items, average, count: items.length });
}

export async function POST(request: NextRequest) {
  const { workspace, userEmail } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add a rating and a few words (max 1500 characters)." },
      { status: 400 }
    );
  }

  const now = Date.now();
  if (now - (lastPost.get(workspace.id) ?? 0) < 5 * 60 * 1000) {
    return NextResponse.json(
      { error: "You just posted one — give it a few minutes." },
      { status: 429 }
    );
  }
  lastPost.set(workspace.id, now);

  const authorName =
    parsed.data.author_name ||
    userEmail?.split("@")[0] ||
    workspace.name ||
    "Anonymous";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("testimonials")
    .insert({
      workspace_id: workspace.id,
      author_name: authorName,
      rating: parsed.data.rating,
      content: parsed.data.content,
    })
    .select("id, author_name, rating, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget founder notification with the rating.
  void notifyOwner({
    type: "Testimonial",
    workspaceName: workspace.name,
    fromEmail: userEmail || workspace.reply_to_email,
    content: `${parsed.data.content}\n\n— ${authorName}`,
    rating: parsed.data.rating,
  });

  return NextResponse.json({ ok: true, item: data });
}
