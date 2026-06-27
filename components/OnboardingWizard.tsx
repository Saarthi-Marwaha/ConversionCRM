"use client";

import { useMemo, useState } from "react";
import { createWorkspace } from "@/app/auth/actions";
import { cn } from "@/lib/utils";
import {
  Building2,
  Target,
  Globe,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Check,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 bg-gray-50 rounded-md text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

// Pre-win path only — anything that doesn't help the user reach their first
// tracked event (email delivery, SMTP, sender name…) is defaulted and deferred
// to Settings after activation.
const STEPS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "win", label: "Your win", icon: Target },
  { id: "website", label: "Website", icon: Globe },
] as const;

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {optional && (
          <span className="text-gray-400 font-normal text-xs ml-1.5">optional</span>
        )}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <span className="block text-xs text-gray-400 mt-1.5 leading-relaxed">
          {hint}
        </span>
      )}
    </label>
  );
}

export function OnboardingWizard({
  userEmail,
  serverError,
}: {
  userEmail: string;
  serverError?: string;
}) {
  const [step, setStep] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Wizard state ──────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [featureUrl, setFeatureUrl] = useState("");
  const [featureEvent, setFeatureEvent] = useState("");
  const [valueEvent, setValueEvent] = useState("report_created"); // sensible default
  const [valuePrereq, setValuePrereq] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // ── Defaulted + deferred email delivery (editable later in Settings) ──
  // Zero-setup default: ConversionCRM sends for the user (provider "resend"),
  // sender name auto-derives from the product/company, replies go to the
  // account email. None of this is asked before the first win.
  const senderName = `${(productName.trim() || companyName.trim()) || "Your"} Team`;
  const replyTo = userEmail;

  // Win name is defaulted, not required: fall back to a humanized value event
  // ("report_created" → "Report created") so the only required win input is the
  // link.
  const featureNameOut =
    featureName.trim() ||
    valueEvent.trim().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) ||
    "Your key feature";

  // Returns a specific message for the first missing field, or null.
  function validateStep(s: number): string | null {
    switch (s) {
      case 0:
        if (!companyName.trim()) return "Enter your company name to continue.";
        return null; // product name is optional (falls back to company name)
      case 1:
        if (!featureUrl.trim()) return "Paste the link where the win happens.";
        return null; // win name + value event are defaulted — no typing required
      case 2:
        if (websiteUrl.trim().length < 4)
          return "Enter the website URL where you'll install the widget.";
        return null;
      default:
        return null;
    }
  }

  const stepValid = useMemo(
    () => validateStep(step) === null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, companyName, featureName, featureUrl, websiteUrl]
  );

  function next() {
    const err = validateStep(step);
    if (err) {
      setClientError(err);
      return;
    }
    setClientError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-xl">
      {/* ── Progress bar ─────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                i < step ? "text-sky-600" : i === step ? "text-[#0b3a5e]" : "text-gray-300"
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center text-[10px]",
                  i < step
                    ? "bg-sky-500 text-white"
                    : i === step
                      ? "bg-sky-100 text-sky-800"
                      : "bg-gray-100 text-gray-400"
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Step {step + 1} of {STEPS.length} — then you&apos;re at your install
          snippet. Free plan, no card required; everything is editable later in
          Settings.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-card p-6 sm:p-8">
        {(serverError || clientError) && (
          <div className="mb-5 px-4 py-3 bg-red-50 rounded-md text-sm text-red-700">
            {clientError ?? decodeURIComponent(serverError!)}
          </div>
        )}

        {/* ── Step 1: Company ───────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Tell us about your product
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Used in your dashboard and (later) on the emails we send for you.
              </p>
            </div>
            <Field label="Company name">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field
              label="Product name"
              optional
              hint="Defaults to your company name if left blank."
            >
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={companyName ? companyName : "Acme Dashboard"}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {/* ── Step 2: Your win (aha link + name + value event) ─── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                What does &ldquo;it clicked&rdquo; look like for a user?
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                The one moment a user reaches real value. We&apos;ve pre-filled a
                sensible default — confirm or tweak it.
              </p>
            </div>
            <Field
              label="Where does the win happen? (link)"
              hint="Paste the link the button opens — a full URL or a path like /reports/new. No code needed; the widget tracks every click."
            >
              <input
                value={featureUrl}
                onChange={(e) => setFeatureUrl(e.target.value)}
                placeholder="https://yourapp.com/reports/new"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="Name the win">
              <input
                value={featureName}
                onChange={(e) => setFeatureName(e.target.value)}
                placeholder='e.g. "Created first report"'
                className={inputClass}
              />
            </Field>
            <Field
              label="Value event"
              hint="The event you fire when a user reaches the outcome — this drives readiness and upgrade emails. Pre-filled; change only if yours differs."
            >
              <input
                value={valueEvent}
                onChange={(e) => setValueEvent(e.target.value)}
                placeholder="report_created"
                className={inputClass}
              />
            </Field>

            {/* Optional details hidden by default so the win step stays to 3
                fields (audit Q7 — default, don't ask). */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-800"
              >
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")}
                />
                Advanced (optional)
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  <Field
                    label="Near-value steps"
                    optional
                    hint="Prerequisite events on the way to the win (comma-separated). Lets us spot users who are close but stalled."
                  >
                    <input
                      value={valuePrereq}
                      onChange={(e) => setValuePrereq(e.target.value)}
                      placeholder="e.g. project_created, data_imported"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Custom aha event name" optional>
                    <input
                      value={featureEvent}
                      onChange={(e) => setFeatureEvent(e.target.value)}
                      placeholder="e.g. report_opened"
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Website ───────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Where will the widget live?
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                The dashboard shows events only from this site, filtering out
                localhost noise. You&apos;ll get the install snippet right after
                this step.
              </p>
            </div>
            <Field label="Your product's website URL">
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourapp.com"
                className={inputClass}
                autoFocus
              />
            </Field>
            <div className="rounded-md bg-sky-50 px-4 py-3 text-xs text-[#0b3a5e] leading-relaxed">
              Finishing creates your workspace on the <strong>free plan</strong>{" "}
              with a <strong>production API key</strong> and takes you straight to
              your install snippet — no pricing step, no card. We&apos;ll send
              lifecycle emails for you by default; tweak the sender, reply-to or
              your own SMTP anytime in Settings.
            </div>
          </div>
        )}

        {/* ── Navigation ─────────────────────────── */}
        <div className="flex items-center justify-between mt-7">
          <button
            type="button"
            onClick={() => {
              setClientError(null);
              setStep((s) => Math.max(0, s - 1));
            }}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors",
              step === 0 && "invisible"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            // Always enabled — validate on click and name the missing field
            // instead of silently greying the button out.
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 transition-colors"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <form
              action={createWorkspace}
              onSubmit={(e) => {
                const err = validateStep(2);
                if (err) {
                  e.preventDefault();
                  setClientError(err);
                }
              }}
            >
              <input type="hidden" name="company_name" value={companyName} />
              <input type="hidden" name="product_name" value={productName} />
              {/* Defaulted + deferred email delivery */}
              <input type="hidden" name="email_sender_name" value={senderName} />
              <input type="hidden" name="email_provider" value="resend" />
              <input type="hidden" name="reply_to_email" value={replyTo} />
              {/* The win */}
              <input type="hidden" name="key_feature_name" value={featureNameOut} />
              <input type="hidden" name="key_feature_url" value={featureUrl} />
              <input type="hidden" name="key_feature_event" value={featureEvent} />
              <input type="hidden" name="value_event" value={valueEvent} />
              <input type="hidden" name="value_prereq" value={valuePrereq} />
              <input type="hidden" name="website_url" value={websiteUrl} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-[#0b3a5e] hover:bg-[#0d4a78] transition-colors"
              >
                Finish setup
                <Check className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
