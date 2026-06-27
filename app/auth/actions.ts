"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeFeatureUrl } from "@/lib/scoring";
import { PLANS } from "@/lib/plans";
import { normalizeMilestoneConfig } from "@/lib/value-milestone";

// ─────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/signup?error=Email+and+password+are+required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Redirect to onboarding — workspace will be created there
  redirect("/onboarding");
}

// ─────────────────────────────────────────────
// Google OAuth (works for both sign up and sign in)
// ─────────────────────────────────────────────

export async function signInWithGoogle() {
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    redirect(
      `/login?error=${encodeURIComponent(
        error?.message ?? "Google sign-in is not available right now"
      )}`
    );
  }

  redirect(data.url);
}

// ─────────────────────────────────────────────
// Sign In
// ─────────────────────────────────────────────

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/dashboard";

  if (!email || !password) {
    redirect("/login?error=Email+and+password+are+required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // After login, check if workspace already exists — if not, send to onboarding
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createSupabaseAdminClient();
    const { data: workspace } = await admin
      .from("workspaces")
      .select("id, plan")
      .eq("owner_id", user.id)
      .single();

    // Mandatory funnel: set up → choose a plan → dashboard. No bypass.
    if (!workspace) {
      redirect("/onboarding");
    }
    if (!workspace.plan) {
      redirect("/pricing");
    }
  }

  redirect(next);
}

// ─────────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ─────────────────────────────────────────────
// Create Workspace (called from /onboarding)
// ─────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function createWorkspace(formData: FormData) {
  const get = (k: string) => ((formData.get(k) as string) ?? "").trim();

  const companyName = get("company_name");
  const productName = get("product_name");
  const emailSenderName = get("email_sender_name") || productName;
  const provider = get("email_provider") === "smtp" ? "smtp" : "resend";
  const replyToEmail = get("reply_to_email");
  const keyFeatureName = get("key_feature_name");
  const keyFeatureUrl = get("key_feature_url");
  const rawEvent = get("key_feature_event");
  let websiteUrl = get("website_url").replace(/\/+$/, "");

  if (!companyName || !productName) fail("Company and product name are required");
  if (!keyFeatureName) fail("Name your aha-moment feature");
  if (!keyFeatureUrl) fail("The feature button link is required");
  // Accept the link however it's typed — bare domain (no https/www) or path.
  const normalizedFeatureUrl = normalizeFeatureUrl(keyFeatureUrl);
  if (!normalizedFeatureUrl) {
    fail("Enter a feature link, e.g. acme.com/feature or /feature");
  }
  if (!websiteUrl) fail("Your website URL is required");
  if (!websiteUrl.startsWith("http")) websiteUrl = `https://${websiteUrl}`;

  // ── Email delivery (Gmail/any inbox via built-in sender, or own SMTP) ──
  const smtp: Record<string, unknown> = {};
  if (provider === "smtp") {
    const host = get("smtp_host");
    const port = Number(get("smtp_port"));
    const user = get("smtp_user");
    const pass = (formData.get("smtp_pass") as string) ?? "";
    const fromEmail = get("smtp_from_email");
    if (!host || host.length > 255) fail("Enter a valid SMTP host");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail("Enter a valid SMTP port (465 or 587)");
    }
    if (!user) fail("SMTP username is required");
    if (!pass) fail("SMTP password is required");
    if (fromEmail && !EMAIL_RE.test(fromEmail)) {
      fail("SMTP from address must be a valid email");
    }
    smtp.smtp_host = host;
    smtp.smtp_port = port;
    smtp.smtp_user = user;
    smtp.smtp_pass = pass;
    smtp.smtp_secure = get("smtp_secure") !== "starttls";
    smtp.smtp_from_email = fromEmail || null;
    // Replies default to the SMTP identity when not set explicitly.
    if (replyToEmail && !EMAIL_RE.test(replyToEmail)) {
      fail("Enter a valid reply-to email");
    }
  } else {
    if (!replyToEmail) fail("Enter the inbox that should receive replies");
    if (!EMAIL_RE.test(replyToEmail)) fail("Enter a valid reply-to email");
  }

  const resolvedReplyTo =
    replyToEmail ||
    (smtp.smtp_from_email as string | null) ||
    (smtp.smtp_user as string | undefined) ||
    null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createSupabaseAdminClient();

  // Idempotent: if this owner already has a workspace (double-submit, a retry
  // after a partial failure, or a previous attempt that actually succeeded),
  // treat it as done and send them straight to the install screen.
  const { data: existing } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect("/dashboard/guide?welcome=1");
  }

  // Production API key for this workspace's widget
  const apiKey = `ccrm_${crypto.randomUUID().replace(/-/g, "")}`;

  const slug = (s: string) =>
    s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 64);

  const event = slug(rawEvent);

  // ── Value milestone (drives readiness + upgrade emails — see
  //    lib/value-milestone.ts). Captured in the wizard; defaults to the aha
  //    event, then a slug of the feature name, so it's never empty. It is
  //    persisted in a SEPARATE, best-effort step AFTER creation so that a
  //    not-yet-migrated `value_milestone` column can never block onboarding. ──
  const valueEvent =
    slug(get("value_event")) || event || slug(keyFeatureName) || "value_achieved";
  const valuePrereq = get("value_prereq")
    .split(/[,\n]/)
    .map((s) => slug(s))
    .filter(Boolean);
  const valueMilestoneRaw = {
    enabled: true,
    label: keyFeatureName || "Value milestone",
    matcher: { kind: "event", event: valueEvent },
    vanityEvents: ["click", "page_view", "time_spent", "page_time"],
    nearValue: valuePrereq.length
      ? [{ kind: "prerequisites", events: valuePrereq, fraction: 0.8 }]
      : [],
  };
  const valueMilestone = normalizeMilestoneConfig(valueMilestoneRaw)
    ? valueMilestoneRaw
    : null;

  // ── Core insert — only long-stable columns, so creation never depends on a
  //    pending migration. Retries transient failures and re-checks for an
  //    existing row each retry, so a silent success is never duplicated. ──
  const corePayload = {
    name: companyName,
    product_name: productName,
    owner_id: user.id,
    api_key: apiKey,
    website_url: websiteUrl,
    key_feature_name: keyFeatureName,
    key_feature_url: normalizedFeatureUrl,
    key_feature_event: event || null,
    reply_to_email: resolvedReplyTo,
    email_sender_name: emailSenderName,
    email_provider: provider,
    ...smtp,
    trial_length_days: 14,
    // Default to Free immediately — no pricing wall between finishing setup
    // and the install snippet. Upgrades live in Billing.
    plan: "free",
    email_quota: PLANS.free.emailQuota,
    plan_status: "active",
    plan_selected_at: new Date().toISOString(),
  };

  let created = false;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
      // A prior attempt may have actually committed before the error surfaced.
      const { data: nowExists } = await admin
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (nowExists) {
        created = true;
        break;
      }
    }

    const { data: row, error } = await admin
      .from("workspaces")
      .insert(corePayload)
      .select("id")
      .maybeSingle();

    if (!error && row) {
      created = true;
      break;
    }
    // Unique violation on owner = another attempt already created it.
    if (error?.code === "23505") {
      created = true;
      break;
    }
    console.error(
      `[createWorkspace] insert attempt ${attempt + 1} failed:`,
      error?.code,
      error?.message
    );
  }

  if (!created) {
    fail("Couldn't create your workspace just now — please click Finish setup again.");
  }

  // Best-effort: attach the value milestone. A missing column (migration 024
  // not yet applied) or any other issue must NOT fail onboarding.
  if (valueMilestone) {
    const { error: vmErr } = await admin
      .from("workspaces")
      .update({ value_milestone: valueMilestone })
      .eq("owner_id", user.id);
    if (vmErr) {
      console.warn(
        "[createWorkspace] value_milestone not stored (apply migration 024):",
        vmErr.message
      );
    }
  }

  // Straight to the install snippet — value before any upsell.
  redirect("/dashboard/guide?welcome=1");
}
