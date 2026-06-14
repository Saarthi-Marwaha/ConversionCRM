"use client";

import { useState } from "react";
import Link from "next/link";
import { planById, type PlanId } from "@/lib/plans";

interface Props {
  plan: PlanId;
  planStatus: string | null;
  renewsAt: string | null;
  pendingPlan: PlanId | null;
  pendingStartsAt: string | null;
}

function fmt(d: string | null): string {
  if (!d) return "the end of the period";
  return new Date(d).toLocaleDateString();
}

export function BillingSection({
  plan,
  planStatus,
  renewsAt,
  pendingPlan,
  pendingStartsAt,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const def = planById(plan);
  const isPaid = plan !== "free";
  const cancelled = planStatus === "cancelled";

  async function cancel() {
    if (
      !window.confirm(
        "Cancel your subscription? You'll keep your current plan until the period ends, then move to the Free plan."
      )
    )
      return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/billing/cancel", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMsg(d.message ?? "Subscription cancelled.");
      else setErr(d.error ?? "Could not cancel.");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Billing</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            You&apos;re on the{" "}
            <span className="font-semibold text-[#0b3a5e]">{def.name}</span> plan
            {isPaid && def.priceUsd ? ` ($${def.priceUsd}/mo)` : ""}.
            {isPaid && renewsAt && !cancelled
              ? ` Renews ${fmt(renewsAt)}.`
              : ""}
            {cancelled ? ` Active until ${fmt(renewsAt)}, then Free.` : ""}
          </p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition-colors"
        >
          {isPaid ? "Change plan" : "Upgrade"}
        </Link>
      </div>

      {pendingPlan && (
        <div className="rounded-md bg-sky-50 px-4 py-3 text-sm text-sky-700">
          Scheduled change: your{" "}
          <strong>{planById(pendingPlan).name}</strong> plan starts on{" "}
          <strong>{fmt(pendingStartsAt)}</strong>, when your current month ends.
        </div>
      )}

      {msg && (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {isPaid && !cancelled && (
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {busy ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}
    </section>
  );
}
