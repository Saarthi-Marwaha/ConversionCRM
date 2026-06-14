import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Full-panel "this feature is locked on your plan" screen. Rendered in place
 * of a gated feature (e.g. the composer) when the workspace's plan doesn't
 * include it, so locking is obvious — not just a silent API 403.
 */
export function UpgradeGate({
  title,
  description,
  requiredPlan,
}: {
  title: string;
  description?: string;
  requiredPlan: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-sky-100 bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold text-[#0b3a5e]">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">
        {description ??
          `This feature isn't included in your current plan.`}{" "}
        Available on <span className="font-semibold text-[#0b3a5e]">{requiredPlan}</span> and above.
      </p>
      <Link
        href="/pricing"
        className="mt-6 inline-block rounded-md bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
      >
        Upgrade to {requiredPlan}
      </Link>
    </div>
  );
}
