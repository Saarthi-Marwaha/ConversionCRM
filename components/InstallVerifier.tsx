"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Zap, Loader2 } from "lucide-react";

type State = "idle" | "sending" | "ok" | "fail";

/**
 * In-product install verification (audit Fix 6). Fires a test event through the
 * server (so it isn't filtered by the dashboard's own origin) and confirms the
 * pipeline accepted it — a clear pass/fail with retry, so onboarding isn't
 * "done" until tracking is proven (or explicitly skipped).
 */
export function InstallVerifier() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/dashboard/test-connection", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Request failed (${res.status}).`);
        setState("fail");
        return;
      }
      setState("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setState("fail");
    }
  }

  if (state === "ok") {
    return (
      <div className="flex items-start gap-2.5 rounded-md bg-emerald-100/70 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
        <span>
          <strong>Tracking confirmed.</strong> ConversionCRM received a test event
          for your workspace — the pipeline works. Once your widget is live, real
          users will appear on the dashboard, scored and staged.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={verify}
          disabled={state === "sending"}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60"
        >
          {state === "sending" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending test event…
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              {state === "fail" ? "Retry test event" : "Send a test event to verify"}
            </>
          )}
        </button>
        <span className="text-xs text-emerald-700/80">
          Confirms ConversionCRM is receiving events for your workspace.
        </span>
      </div>
      {state === "fail" && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          {error ?? "Couldn't reach the tracking endpoint. Check your connection and retry."}
        </div>
      )}
    </div>
  );
}
