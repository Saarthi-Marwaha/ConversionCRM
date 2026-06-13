"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Star, X, MessageSquareHeart } from "lucide-react";

type Testimonial = {
  id: string;
  author_name: string;
  rating: number;
  content: string;
  created_at: string;
};

function Stars({
  value,
  onChange,
  size = "h-5 w-5",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={cn(
            onChange && "cursor-pointer hover:scale-110 transition-transform"
          )}
        >
          <Star
            className={cn(
              size,
              n <= value ? "fill-sky-500 text-sky-500" : "text-gray-200"
            )}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Floating "Add testimonial" widget — present on every dashboard page.
 * Opens a panel with the write+rate form, plus the permanent wall of every
 * testimonial ever submitted (write-once, never deleted).
 */
export function TestimonialWidget() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [average, setAverage] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<
    { k: "idle" } | { k: "sending" } | { k: "done" } | { k: "error"; msg: string }
  >({ k: "idle" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/testimonials", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items as Testimonial[]);
      setAverage(json.average as number | null);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function submit() {
    if (state.k === "sending" || rating === 0 || content.trim().length < 3)
      return;
    setState({ k: "sending" });
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          content,
          author_name: name.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setContent("");
      setRating(0);
      setState({ k: "done" });
      setItems((cur) => (cur ? [json.item, ...cur] : [json.item]));
      setTimeout(() => setState({ k: "idle" }), 2500);
    } catch (e) {
      setState({ k: "error", msg: e instanceof Error ? e.message : "Failed" });
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#0b3a5e] text-white pl-3.5 pr-4 py-2.5 text-sm font-semibold shadow-card-lg hover:bg-[#0d4a78] transition-colors"
      >
        <MessageSquareHeart className="h-4 w-4" />
        <span className="hidden sm:inline">Add testimonial</span>
        <span className="sm:hidden">Review</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-card-lg flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between shadow-soft">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Testimonials
                </h2>
                {average !== null && items && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {average} / 5 average · {items.length} review
                    {items.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-2 rounded-md text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Write form */}
              <div className="p-5 space-y-3 bg-sky-50/60">
                <p className="text-xs font-semibold text-gray-700">
                  Rate ConversionCRM
                </p>
                <Stars value={rating} onChange={setRating} size="h-6 w-6" />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder="What's working for you? What did it change?"
                  className="w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Your name (optional)"
                  className="w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={
                      state.k === "sending" ||
                      rating === 0 ||
                      content.trim().length < 3
                    }
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors",
                      rating > 0 &&
                        content.trim().length >= 3 &&
                        state.k !== "sending"
                        ? "bg-sky-500 hover:bg-sky-600"
                        : "bg-gray-300 cursor-not-allowed"
                    )}
                  >
                    {state.k === "sending" ? "Posting…" : "Post testimonial"}
                  </button>
                  {state.k === "done" && (
                    <span className="text-xs font-medium text-sky-800">
                      ✓ Posted — thank you!
                    </span>
                  )}
                  {state.k === "error" && (
                    <span className="text-xs font-medium text-red-600">
                      {state.msg}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  Testimonials are public to all ConversionCRM users and can&apos;t
                  be deleted.
                </p>
              </div>

              {/* Wall */}
              <div className="p-5 space-y-4">
                {!items && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Loading…
                  </p>
                )}
                {items && items.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No testimonials yet — yours will be the first.
                  </p>
                )}
                {items?.map((t) => (
                  <div key={t.id} className="rounded-md bg-gray-50/80 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <Stars value={t.rating} size="h-3.5 w-3.5" />
                      <time className="text-[10px] text-gray-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(t.created_at), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                    <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap break-words">
                      {t.content}
                    </p>
                    <p className="text-xs font-semibold text-[#0b3a5e] mt-2">
                      — {t.author_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
