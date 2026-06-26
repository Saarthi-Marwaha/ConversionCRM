"use client";

import { useState, useTransition } from "react";
import { saveValueMilestone } from "@/app/dashboard/settings/actions";
import { Target, ChevronDown } from "lucide-react";

const inputClass =
  "w-full text-sm bg-gray-50 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

type RawMilestone = Record<string, unknown> | null;

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function ValueMilestoneForm({ current }: { current: RawMilestone }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const c = current ?? {};
  const matcher = (c.matcher ?? {}) as Record<string, unknown>;
  const isSimpleEvent = matcher.kind === "event";
  const [enabled, setEnabled] = useState(c.enabled !== false && !!c.matcher);

  const nearFirst = (Array.isArray(c.nearValue) ? c.nearValue[0] : null) as
    | Record<string, unknown>
    | undefined;

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveValueMilestone(formData);
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form action={handleSave} className="space-y-4">
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="vm_enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-400"
        />
        <span className="text-sm font-medium text-gray-800">
          Use a value milestone to drive readiness
        </span>
      </label>

      <div className={enabled ? "space-y-3" : "space-y-3 opacity-50 pointer-events-none"}>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Milestone name</span>
          <input
            name="vm_label"
            defaultValue={typeof c.label === "string" ? c.label : ""}
            placeholder="e.g. First project created"
            maxLength={120}
            className={`${inputClass} mt-1`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">
            Value event <span className="text-sky-600">*</span>
          </span>
          <input
            name="vm_event"
            defaultValue={isSimpleEvent && typeof matcher.event === "string" ? matcher.event : ""}
            placeholder="e.g. project_created, integration_connected, transaction_succeeded"
            maxLength={64}
            className={`${inputClass} mt-1`}
          />
          <span className="block text-[11px] text-gray-400 mt-1 leading-relaxed">
            The single event that proves a user reached the core outcome. Fired
            from your app (frontend or backend) via{" "}
            <code className="bg-gray-100 px-1 rounded">
              ConversionCRM.track(&quot;project_created&quot;)
            </code>
            . Only this — not clicks or pageviews — crosses the value line.
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Near-value steps{" "}
              <span className="font-normal text-gray-400">optional</span>
            </span>
            <input
              name="vm_prereq"
              defaultValue={asArray(nearFirst?.events).join(", ")}
              placeholder="step_a, step_b, integration_connected"
              className={`${inputClass} mt-1`}
            />
            <span className="block text-[11px] text-gray-400 mt-1">
              Prerequisite events. A user who does most of these but not the
              value event is flagged <strong>near value</strong>.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Vanity events{" "}
              <span className="font-normal text-gray-400">down-weighted</span>
            </span>
            <input
              name="vm_vanity"
              defaultValue={asArray(c.vanityEvents).join(", ")}
              placeholder="click, page_view, hover"
              className={`${inputClass} mt-1`}
            />
            <span className="block text-[11px] text-gray-400 mt-1">
              Excluded from value &amp; near-value so activity alone never
              inflates readiness.
            </span>
          </label>
        </div>

        <label className="block max-w-[12rem]">
          <span className="text-xs font-semibold text-gray-700">
            At-risk after (days)
          </span>
          <input
            name="vm_at_risk_days"
            type="number"
            min={1}
            max={90}
            defaultValue={typeof c.atRiskDays === "number" ? c.atRiskDays : 14}
            className={`${inputClass} mt-1`}
          />
        </label>

        {/* Advanced computed matcher */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-800"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced: computed condition (multiple events / properties)
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-1.5">
              <textarea
                name="vm_matcher_json"
                rows={4}
                defaultValue={!isSimpleEvent && c.matcher ? JSON.stringify(c.matcher, null, 2) : ""}
                placeholder={`{ "kind": "all", "of": [\n  { "kind": "event", "event": "integration_connected" },\n  { "kind": "count", "event": "transaction", "atLeast": 1 }\n] }`}
                spellCheck={false}
                className={`${inputClass} font-mono text-xs leading-relaxed`}
              />
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Overrides the value event above when set. Supports{" "}
                <code className="bg-gray-100 px-1 rounded">event</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">property</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">count</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">all</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">any</code>.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-semibold bg-sky-500 text-white rounded-md hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save value milestone"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="rounded-lg bg-sky-50 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 mb-2">
          <Target className="h-3.5 w-3.5" />
          How readiness changes
        </div>
        <ul className="text-xs text-gray-600 leading-relaxed space-y-1 list-disc pl-4">
          <li>Generic activity (clicks, pageviews) contributes at most ~40 — never enough to look ready.</li>
          <li>Crossing the value event is the dominant signal and pushes readiness past 70.</li>
          <li>Upgrade emails wait until value is achieved; nudges target near-value users.</li>
        </ul>
      </div>
    </form>
  );
}
