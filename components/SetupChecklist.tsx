"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Code2, Sparkles, Target, X, ArrowRight } from "lucide-react";

/**
 * Overview setup checklist. Shows ONLY the steps a workspace still needs:
 *   - Attach the tracking snippet — shown only while no event has been received
 *     yet (real widget traffic OR the Settings "Send test event" confirmation
 *     both produce events). The moment events arrive this item disappears.
 *     It also has a close (X) button to dismiss manually.
 *   - Set the aha moment — only while key_feature_url is unset.
 *   - Define the value milestone — only while no milestone is configured.
 * Renders nothing when there's nothing left to do.
 */
export function SetupChecklist({
  workspaceId,
  ahaConfigured,
  valueMilestoneConfigured,
  eventsCount,
}: {
  workspaceId: string;
  ahaConfigured: boolean;
  valueMilestoneConfigured: boolean;
  /** Events received in the current range. null = still loading. */
  eventsCount: number | null;
}) {
  const dismissKey = `ccrm-snippet-dismissed:${workspaceId}`;
  const attachedKey = `ccrm-snippet-attached:${workspaceId}`;
  const [snippetDismissed, setSnippetDismissed] = useState(false);
  const [attachedEver, setAttachedEver] = useState(false);

  useEffect(() => {
    setSnippetDismissed(localStorage.getItem(dismissKey) === "1");
    setAttachedEver(localStorage.getItem(attachedKey) === "1");
  }, [dismissKey, attachedKey]);

  // Sticky "attached": once any event has ever landed for this workspace
  // (real widget traffic OR the Settings test event), remember it so the
  // prompt can't flicker back when the user changes the date range.
  useEffect(() => {
    if (eventsCount !== null && eventsCount > 0) {
      localStorage.setItem(attachedKey, "1");
      setAttachedEver(true);
    }
  }, [eventsCount, attachedKey]);

  // Wait for the first data load before deciding (don't flash the prompt).
  const showSnippet =
    !attachedEver &&
    eventsCount !== null &&
    eventsCount === 0 &&
    !snippetDismissed;
  const showAha = !ahaConfigured;
  const showValue = !valueMilestoneConfigured;

  if (!showSnippet && !showAha && !showValue) return null;

  function dismissSnippet() {
    localStorage.setItem(dismissKey, "1");
    setSnippetDismissed(true);
  }

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#0b3a5e]">Finish your setup</h2>
        <span className="text-[11px] text-sky-700/70">
          Only the steps you still need are shown
        </span>
      </div>
      <ul className="space-y-2.5">
        {showSnippet && (
          <ChecklistItem
            icon={Code2}
            title="Attach the tracking snippet"
            body="Paste the one-line script on your site, then hit “Send test event” in Settings to confirm it works. This card vanishes the moment any event lands."
            href="/dashboard/settings"
            cta="Get snippet + test"
            onClose={dismissSnippet}
          />
        )}
        {showAha && (
          <ChecklistItem
            icon={Sparkles}
            title="Set your aha moment"
            body="The action that proves a user got value — it powers 20 points of the engagement score and the onboarding nudge."
            href="/dashboard/settings#aha"
            cta="Set aha moment"
          />
        )}
        {showValue && (
          <ChecklistItem
            icon={Target}
            title="Define your value milestone"
            body="The event that means a user reached the core outcome. It drives readiness and decides when upgrade emails fire — not clicks."
            href="/dashboard/settings#value-milestone"
            cta="Define milestone"
          />
        )}
      </ul>
    </div>
  );
}

function ChecklistItem({
  icon: Icon,
  title,
  body,
  href,
  cta,
  onClose,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  href: string;
  cta: string;
  onClose?: () => void;
}) {
  return (
    <li className="relative flex items-start gap-3 rounded-lg bg-white p-3.5 shadow-soft">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{body}</p>
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
        >
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
