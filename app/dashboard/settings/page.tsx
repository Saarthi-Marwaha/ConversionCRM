import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId } from "@/db/queries";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) redirect("/dashboard");

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Workspace configuration</p>
      </div>

      {/* Workspace info */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Workspace</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Workspace name
          </label>
          <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            {workspace.name}
          </p>
        </div>
      </section>

      {/* API key */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">API Key</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Widget API key
          </label>
          <code className="block text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 font-mono break-all">
            {workspace.api_key}
          </code>
          <p className="text-xs text-gray-400 mt-1">
            Keep this secret. Rotate it here if compromised.
          </p>
        </div>
      </section>

      {/* Key feature */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Key Feature (Aha Moment)</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feature name
            </label>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              {workspace.key_feature_name ?? (
                <span className="text-gray-400 italic">Not set</span>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event name to track
            </label>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 font-mono">
              {workspace.key_feature_event ?? (
                <span className="text-gray-400 italic">Not set</span>
              )}
            </p>
          </div>
        </div>
        {/* TODO: add form to update key feature name and event */}
      </section>

      {/* Trial length */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Trial Settings</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trial length
          </label>
          <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            {workspace.trial_length_days} days
          </p>
        </div>
        {/* TODO: add form to update trial length */}
      </section>
    </div>
  );
}
