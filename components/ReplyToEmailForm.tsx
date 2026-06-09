"use client";

import { useState, useTransition } from "react";
import { saveReplyToEmail } from "@/app/dashboard/settings/actions";

export function ReplyToEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveReplyToEmail(formData);
      if ("error" in res) {
        setError(res.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-3">
      <form action={handleSave} className="flex items-center gap-2">
        <input
          type="email"
          name="reply_to_email"
          defaultValue={currentEmail ?? ""}
          placeholder="you@gmail.com"
          required
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Automated emails send from noreply@mail.conversioncrm.com. Replies go to
        this address.
      </p>
    </div>
  );
}
