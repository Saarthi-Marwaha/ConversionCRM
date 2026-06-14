"use client";

import { useState, useTransition } from "react";
import { saveFollowup } from "@/app/dashboard/settings/actions";

interface Props {
  enabled: boolean;
  intervalDays: number;
  maxSends: number;
}

export function FollowupForm({ enabled, intervalDays, maxSends }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveFollowup(formData);
      if ("error" in res) {
        setError(res.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form action={handleSave} className="space-y-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="followup_enabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-300"
        />
        <span className="text-sm text-gray-700">
          Keep following up automatically until the user converts or stops
          engaging
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">
            Re-send the next nudge every
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              name="followup_interval_days"
              defaultValue={intervalDays}
              min={1}
              max={90}
              disabled={!on}
              className="w-20 rounded-md bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-50"
            />
            <span className="text-sm text-gray-500">days of inactivity</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700">
            Stop after at most
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              name="followup_max_sends"
              defaultValue={maxSends}
              min={1}
              max={20}
              disabled={!on}
              className="w-20 rounded-md bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-50"
            />
            <span className="text-sm text-gray-500">follow-ups per stage</span>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        The sequence is behaviour-based: it keeps going only while a user stays
        in a non-converted stage and keeps not acting. It stops automatically
        the moment they convert, upgrade, become a paying user, or take the
        action the email asked for. Paying users are never emailed.
      </p>
    </form>
  );
}
