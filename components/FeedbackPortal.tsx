"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Lightbulb, Bug, Send } from "lucide-react";

type FeedbackItem = {
  id: string;
  kind: "feature" | "issue";
  message: string;
  created_at: string;
};

const inputClass =
  "w-full rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

export function FeedbackPortal() {
  const [kind, setKind] = useState<"feature" | "issue">("feature");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [state, setState] = useState<
    { k: "idle" } | { k: "sending" } | { k: "done" } | { k: "error"; msg: string }
  >({ k: "idle" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items as FeedbackItem[]);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (state.k === "sending" || message.trim().length < 3) return;
    setState({ k: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, company }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setMessage("");
      setState({ k: "done" });
      setItems((cur) => (cur ? [json.item, ...cur] : [json.item]));
      setTimeout(() => setState({ k: "idle" }), 2500);
    } catch (e) {
      setState({ k: "error", msg: e instanceof Error ? e.message : "Failed" });
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Feedback</h1>
        <p className="text-gray-500 text-sm mt-1">
          Suggest a feature or report a problem — every submission lands
          directly with the team.
        </p>
      </div>

      <div className="card p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setKind("feature")}
            className={cn(
              "rounded-md p-3.5 text-left transition-all",
              kind === "feature"
                ? "bg-sky-50 ring-2 ring-sky-400"
                : "bg-gray-50 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Lightbulb className="h-4 w-4 text-sky-500" />
              Suggest a feature
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Something that would make this better for you.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setKind("issue")}
            className={cn(
              "rounded-md p-3.5 text-left transition-all",
              kind === "issue"
                ? "bg-sky-50 ring-2 ring-sky-400"
                : "bg-gray-50 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Bug className="h-4 w-4 text-sky-500" />
              Report an issue
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Something broken, confusing, or slow.
            </p>
          </button>
        </div>

        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          maxLength={120}
          placeholder="Company name (optional)"
          className={inputClass}
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={
            kind === "feature"
              ? "I'd love it if ConversionCRM could…"
              : "What happened, and what did you expect instead?"
          }
          className={cn(inputClass, "resize-y leading-relaxed")}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={state.k === "sending" || message.trim().length < 3}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors",
              message.trim().length >= 3 && state.k !== "sending"
                ? "bg-sky-500 hover:bg-sky-600"
                : "bg-gray-300 cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
            {state.k === "sending" ? "Sending…" : "Send feedback"}
          </button>
          {state.k === "done" && (
            <span className="text-xs font-medium text-sky-800 bg-sky-100 rounded-full px-3 py-1.5">
              ✓ Thank you — received!
            </span>
          )}
          {state.k === "error" && (
            <span className="text-xs font-medium text-red-700 bg-red-50 rounded-full px-3 py-1.5">
              {state.msg}
            </span>
          )}
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Your submissions
        </h2>
        {!items && <p className="text-sm text-gray-400">Loading…</p>}
        {items && items.length === 0 && (
          <p className="text-sm text-gray-400">Nothing yet — be the first.</p>
        )}
        {items && items.length > 0 && (
          <ul className="divide-y divide-gray-50">
            {items.map((f) => (
              <li key={f.id} className="py-3 flex items-start gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center",
                    f.kind === "feature"
                      ? "bg-sky-50 text-sky-600"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {f.kind === "feature" ? (
                    <Lightbulb className="h-3.5 w-3.5" />
                  ) : (
                    <Bug className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {f.message}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {f.kind === "feature" ? "Feature request" : "Issue"} ·{" "}
                    {formatDistanceToNow(new Date(f.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
