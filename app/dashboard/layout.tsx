import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { TestimonialWidget } from "@/components/TestimonialWidget";
import { PlanUsageBar } from "@/components/PlanUsageBar";
import { getQuotaState, reconcileRollover, reconcilePlan } from "@/lib/usage";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, userEmail } = await getActiveWorkspace();

  // Signed in but no workspace yet = onboarding stage. Send them to finish
  // setup — NOT to /login (which the middleware bounces back to /dashboard,
  // causing an infinite redirect loop where the page never loads).
  if (!workspace) redirect("/onboarding");

  // Hard plan gate — no plan chosen yet means no dashboard. There is no way
  // past /pricing for a logged-in workspace until a plan is selected.
  if (!workspace.plan) redirect("/pricing");

  // Apply a scheduled upgrade whose start date has arrived (webhook back-up),
  // then carry unused emails from last month into this one and snapshot usage.
  await reconcilePlan(workspace);
  workspace.rollover_emails = await reconcileRollover(workspace);
  const quota = await getQuotaState(workspace);

  return (
    <div className="min-h-screen lg:flex lg:h-screen bg-[#f4f8fc]">
      <DashboardSidebar workspace={workspace} userEmail={userEmail} />
      <main className="flex-1 lg:overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Setup prompts now live in the Overview's SetupChecklist (only
              shown for the steps a workspace still needs). */}
          <PlanUsageBar
            plan={quota.plan}
            used={quota.used}
            quota={quota.quota}
            percent={quota.percent}
            rollover={quota.rollover}
          />
          {children}
        </div>
      </main>
      <TestimonialWidget />
    </div>
  );
}
