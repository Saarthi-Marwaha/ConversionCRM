"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PartyPopper, Share2, Check, ArrowRight, Radio } from "lucide-react";

/**
 * The "first win" moment — fixes the weakest part of the activation audit
 * ("Prove It Worked"): when a user installs the widget and their first real
 * user shows up, the product used to say nothing. Now it:
 *   - names the OUTCOME in the user's language (not "an event was tracked"),
 *   - gives them something polished to SHARE (free word-of-mouth),
 *   - and, before that, frames the empty state around the win that's coming.
 */

type FirstWinData = {
  workspace: { name: string };
  users: { email: string | null; user_id: string }[];
  totals: { users: number };
} | null;

const SITE = "https://www.conversioncrm.co";

export function FirstWinCard({ data }: { data: FirstWinData }) {
  const [dismissed, setDismissed] = useState(true); // hidden until we know the key
  const [copied, setCopied] = useState(false);

  const wsName = data?.workspace.name ?? "your product";
  const storageKey = data ? `ccrm-firstwin-dismissed:${wsName}` : null;

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (!data) return null;

  const count = data.totals.users;

  // ── Empty state: set up the win that's coming (outcome-framed) ──────────────
  if (count === 0) {
    return (
      <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100">
            <Radio className="h-5 w-5 text-sky-600" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">
              You&apos;re set up — now let&apos;s catch your first user
            </h2>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              Open your app while logged in and do anything. Your first user
              appears here within seconds — already scored and staged. The
              moment they do, you&apos;ll see exactly{" "}
              <strong className="text-gray-800">
                who&apos;s engaging and who&apos;s about to slip away
              </strong>
              .
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Grab your install snippet
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── The win: only early-stage workspaces, and only until dismissed ──────────
  if (dismissed || count > 50) return null;

  const firstUser = data.users[0]?.email ?? data.users[0]?.user_id ?? "your first user";
  const shareText = `Just set up ConversionCRM on ${wsName} — now I can see every signup's engagement score, lifecycle stage, and exactly who's about to upgrade or slip away. Signups → paid, on autopilot. ${SITE}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url: SITE });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* user cancelled share — no-op */
    }
  }

  function dismiss() {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-500 to-[#0b3a5e] p-5 sm:p-6 text-white shadow-card">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
          <PartyPopper className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">You&apos;re live on {wsName} 🎉</h2>
          <p className="mt-1 text-sm text-sky-50 leading-relaxed">
            <strong className="text-white">{firstUser}</strong> just showed up —
            and you can already see their engagement score, what they did, and
            which lifecycle stage they&apos;re in. This is the whole point:{" "}
            <strong className="text-white">
              you now know who&apos;s about to convert and who&apos;s slipping
              away
            </strong>
            , automatically.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-[#0b3a5e] transition-colors hover:bg-sky-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied to share
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" /> Share you&apos;re live
                </>
              )}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs font-medium text-sky-100/80 transition-colors hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
