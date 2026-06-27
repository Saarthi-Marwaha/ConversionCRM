"use client";

import { useMemo, useState } from "react";
import { createWorkspace } from "@/app/auth/actions";
import { cn } from "@/lib/utils";
import {
  Building2,
  Mail,
  Server,
  Target,
  Globe,
  ArrowRight,
  ArrowLeft,
  Lock,
  Check,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 bg-gray-50 rounded-md text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

const STEPS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "email", label: "Email delivery", icon: Mail },
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

  // ── Wizard state ──────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState(userEmail);
  const [smtpInterest, setSmtpInterest] = useState(false); // wants SMTP (Basic+)
  const [featureName, setFeatureName] = useState("");
  const [featureUrl, setFeatureUrl] = useState("");
  const [featureEvent, setFeatureEvent] = useState("");
  const [valueEvent, setValueEvent] = useState("");
  const [valuePrereq, setValuePrereq] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Returns a specific message for the first missing/invalid field, or null.
  function validateStep(s: number): string | null {
    switch (s) {
      case 0:
        if (!companyName.trim()) return "Enter your company name to continue.";
        if (!productName.trim()) return "Enter your product name to continue.";
        return null;
      case 1:
        if (!senderName.trim()) return "Enter the sender name your users will see.";
        if (!EMAIL_RE.test(replyTo.trim()))
          return "Enter a valid reply-to email (where user replies should land).";
        return null;
      case 2:
        if (!featureUrl.trim()) return "Paste the link where the win happens.";
        if (!featureName.trim()) return "Give the win a short name.";
        return null;
      case 3:
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
    [step, companyName, productName, senderName, replyTo, featureName, featureUrl, websiteUrl]
  );

  function next() {
    const err = validateStep(step);
    if (err) {
      setClientError(err);
      return;
    }
    setClientError(null);
    // Pre-fill downstream fields so there's less to type.
    if (step === 0 && !senderName.trim() && productName.trim()) {
      setSenderName(`${productName.trim()} Team`);
    }
    if (step === 2 && !valueEvent.trim()) {
      // Default the value event to the aha event, then a slug of the name.
      const derived =
        featureEvent.trim() ||
        featureName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      if (derived) setValueEvent(derived);
    }
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
          Step {step + 1} of {STEPS.length} — everything here can be changed later
          in Settings. You start on the free plan, no card required.
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
                Shown to your users in emails and reports.
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
            <Field label="Product name">
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Acme Dashboard"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {/* ── Step 2: Email delivery ────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                How should emails be sent?
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                We&apos;ll send your lifecycle emails for free. Replies land in
                your inbox — change anytime in Settings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSmtpInterest(false)}
                className={cn(
                  "rounded-md p-3.5 text-left transition-all",
                  !smtpInterest ? "bg-sky-50 ring-2 ring-sky-400" : "bg-gray-50 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Mail className="h-4 w-4 text-sky-500" />
                  Gmail / any inbox
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Zero setup. We send for you; replies land in your inbox.
                </p>
              </button>
              {/* SMTP is a Basic+ feature — show it, but never collect
                  credentials a Free plan can't use (audit Fix 5). */}
              <button
                type="button"
                onClick={() => setSmtpInterest(true)}
                className={cn(
                  "relative rounded-md p-3.5 text-left transition-all",
                  smtpInterest ? "bg-amber-50 ring-2 ring-amber-300" : "bg-gray-50 hover:bg-gray-100"
                )}
              >
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                  <Lock className="h-2.5 w-2.5" /> Basic
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Server className="h-4 w-4 text-gray-400" />
                  My own SMTP
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Send from your domain. Unlocks on Basic.
                </p>
              </button>
            </div>

            {smtpInterest && (
              <div className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                Sending from your own domain is a <strong>Basic</strong> feature.
                For now you&apos;ll send through ConversionCRM for free — finish
                setup, then add your SMTP details in{" "}
                <strong>Settings → Email delivery</strong> after upgrading. Nothing
                here is wasted.
              </div>
            )}

            <Field
              label="Sender name"
              hint="What your users see in their inbox, e.g. “Acme Team”."
            >
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={productName ? `${productName} Team` : "Acme Team"}
                className={inputClass}
              />
            </Field>

            <Field
              label="Reply-to inbox (Gmail or any email)"
              hint="When users reply to automated emails, the reply lands here."
            >
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="you@gmail.com"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {/* ── Step 3: Your win (aha moment + value milestone) ─── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                What does &ldquo;it clicked&rdquo; look like for a user?
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Two quick things that make scoring sharp: the link a user clicks
                when your product works, and the <strong>event</strong> that
                proves they actually reached the outcome.
              </p>
            </div>
            <Field
              label="Where does the win happen? (link)"
              hint="Paste the link the button opens — a full URL or a path like /reports/new. Clicking through to it counts as reaching the win. No code needed."
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
              hint="The event you fire when a user reaches the core outcome (e.g. report_created, project_created). This — not clicks — drives readiness and upgrade emails. We pre-fill a sensible default; confirm or change it."
            >
              <input
                value={valueEvent}
                onChange={(e) => setValueEvent(e.target.value)}
                placeholder="e.g. report_created"
                className={inputClass}
              />
            </Field>
            <Field
              label="Near-value steps"
              optional
              hint="Prerequisite events a user does on the way to the win (comma-separated). Lets us spot users who are close but stalled."
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

        {/* ── Step 4: Website ───────────────────── */}
        {step === 3 && (
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
              Finishing creates your workspace on the{" "}
              <strong>free plan</strong> with a{" "}
              <strong>production API key</strong> and takes you straight to your
              install snippet — no pricing step, no card.
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
            // (audit Fix 7a) instead of silently greying the button out.
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
                const err = validateStep(3);
                if (err) {
                  e.preventDefault();
                  setClientError(err);
                }
              }}
            >
              <input type="hidden" name="company_name" value={companyName} />
              <input type="hidden" name="product_name" value={productName} />
              <input type="hidden" name="email_sender_name" value={senderName} />
              <input type="hidden" name="email_provider" value="resend" />
              <input type="hidden" name="reply_to_email" value={replyTo} />
              <input type="hidden" name="key_feature_name" value={featureName} />
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
