"use client";

import { useMemo, useState } from "react";
import { createWorkspace } from "@/app/auth/actions";
import { cn } from "@/lib/utils";
import {
  Building2,
  Mail,
  Server,
  Sparkles,
  Globe,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  X,
  Check,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 bg-gray-50 rounded-md text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

const STEPS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "email", label: "Email delivery", icon: Mail },
  { id: "aha", label: "Aha moment", icon: Sparkles },
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
          <span className="text-gray-400 font-normal text-xs ml-1.5">
            optional
          </span>
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

/** Step-by-step modal — only offered for genuinely complex inputs (SMTP). */
function SmtpHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-card-lg max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">
            How to get your SMTP details
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs font-semibold text-sky-900 mb-2">
          Using Gmail / Google Workspace
        </p>
        <ol className="text-xs text-gray-600 space-y-2 leading-relaxed list-decimal pl-4 mb-4">
          <li>
            Go to{" "}
            <span className="font-mono text-sky-700">
              myaccount.google.com/apppasswords
            </span>{" "}
            (you need 2-step verification turned on).
          </li>
          <li>
            Create an app password named &ldquo;ConversionCRM&rdquo; and copy
            the 16-character code — that&apos;s your <strong>password</strong>{" "}
            here (not your Gmail password).
          </li>
          <li>
            Host: <span className="font-mono">smtp.gmail.com</span> · Port:{" "}
            <span className="font-mono">465</span> · Security: SSL/TLS ·
            Username: your full Gmail address.
          </li>
        </ol>

        <p className="text-xs font-semibold text-sky-900 mb-2">
          Using Outlook / Microsoft 365
        </p>
        <ol className="text-xs text-gray-600 space-y-2 leading-relaxed list-decimal pl-4 mb-4">
          <li>
            Host: <span className="font-mono">smtp.office365.com</span> ·
            Port: <span className="font-mono">587</span> · Security: STARTTLS.
          </li>
          <li>
            Username is your full email; create an app password under
            Security settings if you use MFA.
          </li>
        </ol>

        <p className="text-xs font-semibold text-sky-900 mb-2">
          Any other provider (Zoho, SES, Postmark…)
        </p>
        <p className="text-xs text-gray-600 leading-relaxed mb-4">
          Search &ldquo;<em>your provider</em> SMTP settings&rdquo; — every
          provider publishes a host, a port (465 or 587), and tells you
          whether to use SSL or STARTTLS. Username and password are usually
          your account credentials or an app password.
        </p>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          No DNS setup is needed — your provider already signs its own mail,
          so emails deliver exactly like ones sent from your inbox.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-md transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
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
  const [showSmtpHelp, setShowSmtpHelp] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // ── All wizard state ──────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [provider, setProvider] = useState<"resend" | "smtp">("resend");
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState(userEmail);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState<"ssl" | "starttls">("ssl");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [featureUrl, setFeatureUrl] = useState("");
  const [featureEvent, setFeatureEvent] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return companyName.trim().length > 0 && productName.trim().length > 0;
      case 1:
        if (!senderName.trim()) return false;
        if (provider === "resend") return EMAIL_RE.test(replyTo.trim());
        return (
          smtpHost.trim().length > 0 &&
          Number(smtpPort) > 0 &&
          smtpUser.trim().length > 0 &&
          smtpPass.length > 0
        );
      case 2:
        return (
          featureName.trim().length > 0 &&
          (featureUrl.trim().startsWith("/") ||
            /^https?:\/\/\S+$/i.test(featureUrl.trim()))
        );
      case 3:
        return websiteUrl.trim().length > 3;
      default:
        return false;
    }
  }, [step, companyName, productName, provider, senderName, replyTo, smtpHost, smtpPort, smtpUser, smtpPass, featureName, featureUrl, websiteUrl]);

  function next() {
    if (!stepValid) {
      setClientError("Fill in the highlighted fields to continue.");
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
                i < step
                  ? "text-sky-600"
                  : i === step
                    ? "text-[#0b3a5e]"
                    : "text-gray-300"
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
          Step {step + 1} of {STEPS.length} — everything here can be changed
          later in Settings.
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
                Lifecycle and composer emails go out through one of these —
                toggle anytime.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider("resend")}
                className={cn(
                  "rounded-md p-3.5 text-left transition-all",
                  provider === "resend"
                    ? "bg-sky-50 ring-2 ring-sky-400"
                    : "bg-gray-50 hover:bg-gray-100"
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
              <button
                type="button"
                onClick={() => setProvider("smtp")}
                className={cn(
                  "rounded-md p-3.5 text-left transition-all",
                  provider === "smtp"
                    ? "bg-sky-50 ring-2 ring-sky-400"
                    : "bg-gray-50 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Server className="h-4 w-4 text-sky-500" />
                  My own SMTP
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Send from your domain via Gmail, Outlook, SES — any SMTP.
                </p>
              </button>
            </div>

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

            {provider === "resend" && (
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
            )}

            {provider === "smtp" && (
              <div className="space-y-4 rounded-md bg-gray-50/70 p-4">
                <button
                  type="button"
                  onClick={() => setShowSmtpHelp(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  How do I get these details?
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Field label="SMTP host">
                      <input
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className={cn(inputClass, "bg-white")}
                      />
                    </Field>
                  </div>
                  <Field label="Port">
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="465"
                      className={cn(inputClass, "bg-white")}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Username">
                    <input
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="you@yourdomain.com"
                      autoComplete="off"
                      className={cn(inputClass, "bg-white")}
                    />
                  </Field>
                  <Field label="Password (app password)">
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={cn(inputClass, "bg-white")}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Security">
                    <select
                      value={smtpSecure}
                      onChange={(e) =>
                        setSmtpSecure(e.target.value as "ssl" | "starttls")
                      }
                      className={cn(inputClass, "bg-white")}
                    >
                      <option value="ssl">SSL/TLS (port 465)</option>
                      <option value="starttls">STARTTLS (port 587)</option>
                    </select>
                  </Field>
                  <Field label="From address" optional>
                    <input
                      type="email"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder="Defaults to username"
                      className={cn(inputClass, "bg-white")}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Aha moment ────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Your aha moment
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                The one feature that proves your product&apos;s value. When a
                user clicks the button that opens this link, we count it as
                <strong> your main feature being used</strong> — it powers 20
                points of the engagement score.
              </p>
            </div>
            <Field
              label="Feature button link (required)"
              hint="Paste the link your main-feature button opens — a full URL or a path like /reports/new. No extra code needed; the widget already tracks every click."
            >
              <input
                value={featureUrl}
                onChange={(e) => setFeatureUrl(e.target.value)}
                placeholder="https://yourapp.com/reports/new"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="Feature name">
              <input
                value={featureName}
                onChange={(e) => setFeatureName(e.target.value)}
                placeholder='e.g. "Create first report"'
                className={inputClass}
              />
            </Field>
            <Field
              label="Custom event name"
              optional
              hint="If you also fire a track() call for this feature, name it here."
            >
              <input
                value={featureEvent}
                onChange={(e) => setFeatureEvent(e.target.value)}
                placeholder="e.g. report_created"
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
                localhost noise. You&apos;ll get the install snippet right
                after this step.
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
              Finishing creates your workspace with a{" "}
              <strong>production API key</strong> and takes you to Settings,
              where the one-line install snippet (and an AI-agent prompt) are
              ready to copy.
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
            <button
              type="button"
              onClick={next}
              disabled={!stepValid}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white transition-colors",
                stepValid
                  ? "bg-sky-500 hover:bg-sky-600"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <form action={createWorkspace}>
              {/* All collected state rides along as hidden fields */}
              <input type="hidden" name="company_name" value={companyName} />
              <input type="hidden" name="product_name" value={productName} />
              <input type="hidden" name="email_sender_name" value={senderName} />
              <input type="hidden" name="email_provider" value={provider} />
              <input type="hidden" name="reply_to_email" value={replyTo} />
              <input type="hidden" name="smtp_host" value={smtpHost} />
              <input type="hidden" name="smtp_port" value={smtpPort} />
              <input type="hidden" name="smtp_user" value={smtpUser} />
              <input type="hidden" name="smtp_pass" value={smtpPass} />
              <input type="hidden" name="smtp_secure" value={smtpSecure} />
              <input type="hidden" name="smtp_from_email" value={smtpFrom} />
              <input type="hidden" name="key_feature_name" value={featureName} />
              <input type="hidden" name="key_feature_url" value={featureUrl} />
              <input type="hidden" name="key_feature_event" value={featureEvent} />
              <input type="hidden" name="website_url" value={websiteUrl} />
              <button
                type="submit"
                disabled={!stepValid}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white transition-colors",
                  stepValid
                    ? "bg-[#0b3a5e] hover:bg-[#0d4a78]"
                    : "bg-gray-300 cursor-not-allowed"
                )}
              >
                Finish setup
                <Check className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {showSmtpHelp && <SmtpHelpModal onClose={() => setShowSmtpHelp(false)} />}
    </div>
  );
}
