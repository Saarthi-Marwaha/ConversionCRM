import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { LiveDashboard } from "@/components/LiveDashboard";
import { normalizeMilestoneConfig } from "@/lib/value-milestone";

export default async function DashboardPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/onboarding");

  return (
    <LiveDashboard
      setup={{
        workspaceId: workspace.id,
        ahaConfigured: !!workspace.key_feature_url,
        valueMilestoneConfigured: !!normalizeMilestoneConfig(workspace.value_milestone),
      }}
    />
  );
}
