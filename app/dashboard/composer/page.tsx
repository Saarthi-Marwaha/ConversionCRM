import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { workspaceSenderName } from "@/lib/emails/workspace-from";
import { EmailComposer } from "@/components/EmailComposer";
import { planAllows } from "@/lib/entitlements";
import { UpgradeGate } from "@/components/UpgradeGate";

export default async function ComposerPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  // The custom-HTML composer is a Pro+ feature.
  if (!planAllows(workspace.plan, "custom_composer")) {
    return (
      <UpgradeGate
        title="Email composer is a Pro feature"
        description="Write and send custom-HTML emails to your users from the dashboard."
        requiredPlan="Pro"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">
          Loading composer…
        </div>
      }
    >
      <EmailComposer
        senderName={workspaceSenderName(workspace)}
        replyToConfigured={!!workspace.reply_to_email}
      />
    </Suspense>
  );
}
