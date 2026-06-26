"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { normalizeFeatureUrl } from "@/lib/scoring";
import { normalizeMilestoneConfig } from "@/lib/value-milestone";

/** snake_case event identifier like the widget sends. */
function slugEvent(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

/** Parse a comma/newline separated list of event names into slugs. */
function eventList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => slugEvent(s))
    .filter(Boolean);
}

/**
 * Save the workspace's Value Milestone. Common case is a single event
 * ("first project created" → event "project_created"); an advanced JSON matcher
 * field lets power users define computed (all/any/count/property) conditions.
 * The full object (including `enabled`) is stored so the form round-trips;
 * the scorer ignores it when enabled is false (normalizeMilestoneConfig → null).
 */
export async function saveValueMilestone(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const enabled = formData.get("vm_enabled") === "on";
  const label = ((formData.get("vm_label") as string) ?? "").trim().slice(0, 120);
  const event = slugEvent((formData.get("vm_event") as string) ?? "");
  const advancedRaw = ((formData.get("vm_matcher_json") as string) ?? "").trim();
  const vanity = eventList((formData.get("vm_vanity") as string) ?? "");
  const prereq = eventList((formData.get("vm_prereq") as string) ?? "");
  const atRiskRaw = Number((formData.get("vm_at_risk_days") as string) ?? "14");
  const atRiskDays =
    Number.isFinite(atRiskRaw) && atRiskRaw >= 1 && atRiskRaw <= 90 ? atRiskRaw : 14;

  // Build the matcher: advanced JSON wins; otherwise the single-event case.
  let matcher: unknown;
  if (advancedRaw) {
    try {
      matcher = JSON.parse(advancedRaw);
    } catch {
      return { error: "Advanced matcher is not valid JSON" };
    }
  } else {
    if (enabled && !event) {
      return { error: "Enter the event that means value was achieved" };
    }
    matcher = { kind: "event", event: event || "value_achieved" };
  }

  const raw = {
    enabled,
    label: label || "Value milestone",
    matcher,
    vanityEvents: vanity,
    nearValue: prereq.length
      ? [{ kind: "prerequisites", events: prereq, fraction: 0.8 }]
      : [],
    atRiskDays,
  };

  // Validate the matcher when enabled (a bad advanced JSON would silently
  // disable scoring otherwise).
  if (enabled && !normalizeMilestoneConfig(raw)) {
    return { error: "Milestone definition is invalid — check the matcher." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ value_milestone: raw })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveWebsiteUrl(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const raw = (formData.get("website_url") as string | null) ?? "";
  // Normalise: strip trailing slash, ensure https:// prefix if a bare domain given
  let url = raw.trim().replace(/\/+$/, "");
  if (url && !url.startsWith("http")) {
    url = `https://${url}`;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ website_url: url || null })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveAhaMoment(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const name = ((formData.get("key_feature_name") as string) ?? "").trim();
  const rawEvent = ((formData.get("key_feature_event") as string) ?? "").trim();
  const rawUrl = ((formData.get("key_feature_url") as string) ?? "").trim();

  // The button link is the backbone of the aha catcher — required. Accept it
  // however the user types it (bare domain, no https/www, or a path).
  if (!rawUrl) {
    return { error: "The feature button link is required" };
  }
  if (rawUrl.length > 500) return { error: "Link is too long" };
  const url = normalizeFeatureUrl(rawUrl);
  if (!url) {
    return { error: "Enter a link, e.g. acme.com/feature or /feature" };
  }

  // Event names are snake_case identifiers like the widget sends.
  const event = rawEvent
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);

  if (name.length > 120) return { error: "Feature name is too long" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      key_feature_name: name || null,
      key_feature_event: event || null,
      key_feature_url: url,
    })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, event };
}

export async function saveEmailDelivery(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const provider = formData.get("email_provider") === "smtp" ? "smtp" : "resend";
  const update: Record<string, unknown> = { email_provider: provider };

  if (provider === "smtp") {
    const host = ((formData.get("smtp_host") as string) ?? "").trim();
    const portRaw = ((formData.get("smtp_port") as string) ?? "").trim();
    const user = ((formData.get("smtp_user") as string) ?? "").trim();
    const pass = (formData.get("smtp_pass") as string) ?? "";
    const fromEmail = ((formData.get("smtp_from_email") as string) ?? "").trim();
    const secure = formData.get("smtp_secure") === "ssl";

    const port = Number(portRaw);
    if (!host || host.length > 255) return { error: "Enter a valid SMTP host" };
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { error: "Enter a valid SMTP port (e.g. 465 or 587)" };
    }
    if (!user) return { error: "SMTP username is required" };
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return { error: "From address must be a valid email" };
    }

    update.smtp_host = host;
    update.smtp_port = port;
    update.smtp_user = user;
    update.smtp_secure = secure;
    update.smtp_from_email = fromEmail || null;
    // Blank password = keep the stored one (never echoed to the client).
    if (pass) {
      if (pass.length > 512) return { error: "Password is too long" };
      update.smtp_pass = pass;
    } else if (!workspace.smtp_pass) {
      return { error: "SMTP password is required" };
    }
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update(update)
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveFollowup(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const enabled = formData.get("followup_enabled") === "on";
  const interval = Number((formData.get("followup_interval_days") as string) ?? "");
  const maxSends = Number((formData.get("followup_max_sends") as string) ?? "");

  if (!Number.isInteger(interval) || interval < 1 || interval > 90) {
    return { error: "Re-send interval must be between 1 and 90 days" };
  }
  if (!Number.isInteger(maxSends) || maxSends < 1 || maxSends > 20) {
    return { error: "Max follow-ups must be between 1 and 20" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      followup_enabled: enabled,
      followup_interval_days: interval,
      followup_max_sends: maxSends,
    })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveReplyToEmail(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const email = ((formData.get("reply_to_email") as string) ?? "").trim();
  const senderName = ((formData.get("email_sender_name") as string) ?? "").trim();
  if (!email) return { error: "Email is required" };
  if (!senderName) return { error: "Sender name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ reply_to_email: email, email_sender_name: senderName })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
