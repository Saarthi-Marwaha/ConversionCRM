import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { planAllows } from "@/lib/entitlements";

export async function GET() {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("trigger, subject, html_body, updated_at")
    .eq("workspace_id", workspace.id);

  if (error) {
    // Table may not exist yet — return empty list gracefully
    if (error.code === "42P01") return NextResponse.json({ templates: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!planAllows(workspace.plan, "custom_composer")) {
    return NextResponse.json(
      { error: "Email template editing requires Basic plan or above." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { trigger, subject, html_body } = body as {
    trigger?: string;
    subject?: string;
    html_body?: string;
  };

  if (!trigger || !subject || !html_body) {
    return NextResponse.json({ error: "trigger, subject, and html_body are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("email_templates").upsert(
    {
      workspace_id: workspace.id,
      trigger,
      subject,
      html_body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,trigger" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!planAllows(workspace.plan, "custom_composer")) {
    return NextResponse.json({ error: "Plan upgrade required" }, { status: 403 });
  }

  const trigger = new URL(req.url).searchParams.get("trigger");
  if (!trigger) return NextResponse.json({ error: "Missing trigger param" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("trigger", trigger);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
