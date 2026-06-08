import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, getStageCounts, getConversionRate7d } from "@/db/queries";
import { redirect } from "next/navigation";
import { StageBreakdownCard } from "@/components/StageBreakdownCard";
import { MetricCard } from "@/components/MetricCard";
import type { LifecycleStage } from "@/types";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const workspace = await getWorkspaceByOwnerId(user.id);

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Set up your workspace
          </h2>
          <p className="text-gray-500 text-sm">
            {/* TODO: workspace onboarding flow */}
            Workspace setup coming soon.
          </p>
        </div>
      </div>
    );
  }

  const [stageCounts, conversionRate] = await Promise.all([
    getStageCounts(workspace.id),
    getConversionRate7d(workspace.id),
  ]);

  const totalUsers = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const paidUsers = stageCounts["paid"] ?? 0;
  const readyToConvert = stageCounts["conversion_ready"] ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">{workspace.name}</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total users" value={totalUsers} />
        <MetricCard label="Paid users" value={paidUsers} highlight />
        <MetricCard label="Ready to convert" value={readyToConvert} />
        <MetricCard
          label="7-day conversion"
          value={`${conversionRate}%`}
          highlight
        />
      </div>

      {/* Stage breakdown */}
      <StageBreakdownCard
        stageCounts={stageCounts as Record<LifecycleStage, number>}
        totalUsers={totalUsers}
      />

      {/* Widget embed snippet */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Add tracking to your app
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Paste this into the{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">&lt;head&gt;</code>{" "}
          of your product.
        </p>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto text-gray-700 whitespace-pre-wrap">
          {`<script src="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io"}/api/widget?api_key=${workspace.api_key}"></script>\n<script>\n  // After login, identify the current user\n  ccrm.identify('USER_ID', { email: 'user@example.com', name: 'Jane' });\n\n  // Track key events\n  ccrm.track('feature_click', { feature: 'export' });\n  ccrm.track('pricing_page_visit');\n</script>`}
        </pre>
      </div>
    </div>
  );
}
