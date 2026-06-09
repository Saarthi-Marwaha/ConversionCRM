"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";

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

export async function saveReplyToEmail(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const email = ((formData.get("reply_to_email") as string) ?? "").trim();
  if (!email) return { error: "Email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ reply_to_email: email })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
