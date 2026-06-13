"use client";

import { useState, useTransition } from "react";
import { saveAhaMoment } from "@/app/dashboard/settings/actions";
import { Sparkles, MousePointerClick } from "lucide-react";

const inputClass =
  "w-full text-sm bg-gray-50 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

export function AhaMomentForm({
  currentName,
  currentEvent,
  currentUrl,
}: {
  currentName: string | null;
  currentEvent: string | null;
  currentUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState(currentEvent ?? "");

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveAhaMoment(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        if (res && "event" in res && typeof res.event === "string") {
          setEventName(res.event);
        }
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!currentUrl && (
        <div className="rounded-md bg-sky-50 px-3.5 py-2.5 text-xs text-[#0b3a5e]">
          <strong>Required:</strong> add your feature button link below — the
          aha moment can&apos;t be detected without it.
        </div>
      )}

      <form action={handleSave} className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">
            Feature button link <span className="text-sky-600">*</span>
          </span>
          <input
            name="key_feature_url"
            defaultValue={currentUrl ?? ""}
            placeholder="https://yourapp.com/reports/new  or  /reports/new"
            required
            maxLength={500}
            className={`${inputClass} mt-1`}
          />
          <span className="block text-[11px] text-gray-400 mt-1 leading-relaxed">
            Paste the link your main-feature button opens. When a user clicks
            a link to this URL (or lands on this page), ConversionCRM counts
            it as <strong>your main feature being used</strong> — no extra
            code needed, the widget already tracks every click.
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Feature name
            </span>
            <input
              name="key_feature_name"
              defaultValue={currentName ?? ""}
              placeholder="e.g. Create report"
              maxLength={120}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Custom event{" "}
              <span className="font-normal text-gray-400">optional</span>
            </span>
            <input
              name="key_feature_event"
              defaultValue={currentEvent ?? ""}
              placeholder="e.g. report_exported"
              maxLength={64}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-semibold bg-sky-500 text-white rounded-md hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save aha moment"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      <div className="rounded-lg bg-sky-50 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          How the catcher works
        </div>
        <ul className="text-xs text-gray-600 leading-relaxed space-y-1.5">
          <li className="flex items-start gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
            Any tracked click on your feature link — or a visit to that page —
            counts automatically and is worth up to{" "}
            <strong>&nbsp;20 score points</strong>.
          </li>
          {eventName && (
            <li>
              Plus, any{" "}
              <code className="text-sky-800 bg-white rounded px-1">
                ConversionCRM.track(&quot;{eventName}&quot;)
              </code>{" "}
              call counts too.
            </li>
          )}
        </ul>
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          Users who hit the aha moment stop receiving the onboarding nudge
          email and climb toward Conversion&nbsp;Ready.
        </p>
      </div>
    </div>
  );
}
