"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Lock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Pencil,
} from "lucide-react";

// ── Email definitions ──────────────────────────────────────────────────────────

type EmailDef = {
  trigger: string;
  name: string;
  stage: string;
  description: string;
  defaultSubject: string;
};

const EMAIL_DEFS: EmailDef[] = [
  {
    trigger: "welcome",
    name: "Welcome",
    stage: "Signup",
    description: "Sent the moment someone signs up. Sets expectations for the next 48 hours.",
    defaultSubject: "You're in — here's what happens in the next 48 hours",
  },
  {
    trigger: "feature_nudge",
    name: "Feature Nudge",
    stage: "Onboarding",
    description: "Sent to users who haven't hit your aha moment yet. Points them to the key feature.",
    defaultSubject: "One thing that changes how {{productName}} works for you",
  },
  {
    trigger: "value_demo",
    name: "Value Demo",
    stage: "Active",
    description: "Sent to active users who haven't upgraded. Demonstrates what they're getting.",
    defaultSubject: "Here's what {{productName}} has been doing for you",
  },
  {
    trigger: "check_in",
    name: "Check-In",
    stage: "Going Quiet",
    description: "Sent when a user goes quiet. Re-engages before they churn.",
    defaultSubject: "Haven't seen you in {{productName}} — quick check-in",
  },
  {
    trigger: "upgrade_offer",
    name: "Upgrade Offer",
    stage: "Conversion Ready",
    description: "Sent when engagement score hits 71+. The primary trial-to-paid conversion email.",
    defaultSubject: "Your engagement score hit {{score}}/100 — you're ready to upgrade",
  },
  {
    trigger: "urgency",
    name: "Urgency",
    stage: "Conversion Ready",
    description: "Follow-up for high-intent users who didn't act on the upgrade offer.",
    defaultSubject: "Your trial window is closing — don't lose your data",
  },
  {
    trigger: "churn_prevention",
    name: "Win-Back",
    stage: "Churned",
    description: "Sent to churned users. Last attempt to bring them back.",
    defaultSubject: "We noticed you left — here's what changed",
  },
  {
    trigger: "limit_upgrade",
    name: "Limit Upgrade",
    stage: "Going Quiet / Active",
    description: "Sent when a user exhausts their free quota. Highest-intent conversion moment.",
    defaultSubject: "You've hit your {{limitLabel}} — here's how to keep going",
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────

type CustomTemplate = {
  trigger: string;
  subject: string;
  html_body: string;
  updated_at: string;
};

type EditorState = {
  trigger: string;
  subject: string;
  html: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  loadingDefault: boolean;
  previewing: boolean;
};

// ── Variable reference ─────────────────────────────────────────────────────────

const VARS = [
  { name: "{{userName}}", desc: "Recipient's name or email prefix" },
  { name: "{{productName}}", desc: "Your product name" },
  { name: "{{appUrl}}", desc: "Your product URL" },
  { name: "{{ctaUrl}}", desc: "CTA / checkout link" },
  { name: "{{score}}", desc: "Engagement score (upgrade_offer only)" },
  { name: "{{limitLabel}}", desc: "Limit type label (limit_upgrade only)" },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const [canEdit, setCanEdit] = useState<boolean | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [openTrigger, setOpenTrigger] = useState<string | null>(null);
  const [editors, setEditors] = useState<Record<string, EditorState>>({});
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  // Load plan capability + existing custom templates
  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((d) => {
        setCustomTemplates(d.templates ?? []);
      });
    // Probe plan
    fetch("/api/email-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then((r) => setCanEdit(r.status !== 403))
      .catch(() => setCanEdit(false));
  }, []);

  function getCustom(trigger: string) {
    return customTemplates.find((t) => t.trigger === trigger) ?? null;
  }

  function getEditor(trigger: string): EditorState {
    return (
      editors[trigger] ?? {
        trigger,
        subject: getCustom(trigger)?.subject ?? "",
        html: getCustom(trigger)?.html_body ?? "",
        dirty: false,
        saving: false,
        error: null,
        loadingDefault: false,
        previewing: false,
      }
    );
  }

  function updateEditor(trigger: string, patch: Partial<EditorState>) {
    setEditors((prev) => ({
      ...prev,
      [trigger]: { ...getEditor(trigger), ...patch },
    }));
  }

  async function loadDefault(trigger: string) {
    updateEditor(trigger, { loadingDefault: true, error: null });
    const r = await fetch(`/api/email-templates/preview?trigger=${trigger}`);
    if (!r.ok) {
      updateEditor(trigger, { loadingDefault: false, error: "Failed to load default template." });
      return;
    }
    const html = await r.text();
    const def = EMAIL_DEFS.find((e) => e.trigger === trigger);
    updateEditor(trigger, {
      html,
      subject: getEditor(trigger).subject || (def?.defaultSubject ?? ""),
      dirty: true,
      loadingDefault: false,
    });
  }

  async function previewHtml(trigger: string) {
    const ed = getEditor(trigger);
    if (!ed.html) return;
    updateEditor(trigger, { previewing: true });
    const r = await fetch("/api/email-templates/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: ed.html }),
    });
    if (!r.ok) { updateEditor(trigger, { previewing: false }); return; }
    const html = await r.text();
    // Open in new tab
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    updateEditor(trigger, { previewing: false });
  }

  async function saveTemplate(trigger: string) {
    const ed = getEditor(trigger);
    if (!ed.subject.trim() || !ed.html.trim()) {
      updateEditor(trigger, { error: "Subject and HTML body are required." });
      return;
    }
    updateEditor(trigger, { saving: true, error: null });
    const r = await fetch("/api/email-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger, subject: ed.subject, html_body: ed.html }),
    });
    const data = await r.json();
    if (!r.ok) {
      updateEditor(trigger, { saving: false, error: data.error ?? "Save failed." });
      return;
    }
    setCustomTemplates((prev) => {
      const others = prev.filter((t) => t.trigger !== trigger);
      return [...others, { trigger, subject: ed.subject, html_body: ed.html, updated_at: new Date().toISOString() }];
    });
    updateEditor(trigger, { saving: false, dirty: false });
  }

  async function resetTemplate(trigger: string) {
    if (!confirm("Reset to the default template? Your custom version will be deleted.")) return;
    await fetch(`/api/email-templates?trigger=${trigger}`, { method: "DELETE" });
    setCustomTemplates((prev) => prev.filter((t) => t.trigger !== trigger));
    setEditors((prev) => {
      const next = { ...prev };
      delete next[trigger];
      return next;
    });
  }

  function toggleOpen(trigger: string) {
    setOpenTrigger((prev) => (prev === trigger ? null : trigger));
    // Pre-fill editor from saved custom template when opening
    if (openTrigger !== trigger) {
      const saved = getCustom(trigger);
      if (saved && !editors[trigger]) {
        updateEditor(trigger, { subject: saved.subject, html: saved.html_body });
      }
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-gray-500 text-sm mt-1">
          Customize the subject and HTML body of each of the 8 lifecycle emails.
          Use <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{"{{userName}}"}</code> and other variables
          to personalize each send.
        </p>
      </div>

      {/* Plan gate */}
      {canEdit === false && (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Email template editing is available on <strong>Basic and above</strong>.{" "}
            <Link href="/pricing" className="font-semibold underline">Upgrade your plan →</Link>
          </span>
        </div>
      )}

      {/* Variable reference */}
      {canEdit && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none">
            Available template variables
          </summary>
          <ul className="mt-3 space-y-1.5">
            {VARS.map((v) => (
              <li key={v.name} className="flex items-center gap-3 text-sm">
                <code className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-mono text-xs whitespace-nowrap">
                  {v.name}
                </code>
                <span className="text-gray-500">{v.desc}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Email cards */}
      <div className="space-y-3">
        {EMAIL_DEFS.map((def) => {
          const custom = getCustom(def.trigger);
          const isOpen = openTrigger === def.trigger;
          const ed = getEditor(def.trigger);

          return (
            <div key={def.trigger} className="card overflow-hidden">
              {/* Header row */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => toggleOpen(def.trigger)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{def.name}</span>
                      <span className="text-[11px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">
                        {def.stage}
                      </span>
                      {custom && (
                        <span className="text-[11px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <CheckCircle className="h-2.5 w-2.5" /> Custom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{def.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {canEdit && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Pencil className="h-3 w-3" /> Edit
                    </span>
                  )}
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Editor panel */}
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                  {/* Free plan: read-only preview prompt */}
                  {canEdit === false && (
                    <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-8 text-center">
                      <Lock className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-3">
                        Upgrade to <strong>Basic</strong> to edit this template.
                      </p>
                      <Link
                        href="/pricing"
                        className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
                      >
                        Upgrade plan →
                      </Link>
                    </div>
                  )}

                  {canEdit && (
                    <>
                      {/* Subject line */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          Subject line
                        </label>
                        <input
                          type="text"
                          value={ed.subject}
                          placeholder={def.defaultSubject}
                          onChange={(e) => updateEditor(def.trigger, { subject: e.target.value, dirty: true })}
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-400">
                          Default: <em>{def.defaultSubject}</em>
                        </p>
                      </div>

                      {/* HTML editor */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            HTML body
                          </label>
                          <button
                            type="button"
                            onClick={() => loadDefault(def.trigger)}
                            disabled={ed.loadingDefault}
                            className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={`h-3 w-3 ${ed.loadingDefault ? "animate-spin" : ""}`} />
                            {ed.loadingDefault ? "Loading…" : "Load default HTML"}
                          </button>
                        </div>
                        <textarea
                          value={ed.html}
                          onChange={(e) => updateEditor(def.trigger, { html: e.target.value, dirty: true })}
                          rows={18}
                          spellCheck={false}
                          placeholder={`<!DOCTYPE html>\n<html>\n<body>\n  <p>Hello {{userName}},</p>\n  <!-- your custom HTML here -->\n</body>\n</html>`}
                          className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-gray-950 text-green-300 leading-relaxed resize-y"
                        />
                        <p className="text-xs text-gray-400">
                          Write full HTML email code, or click <strong>Load default HTML</strong> to start from the existing template.
                        </p>
                      </div>

                      {/* Error */}
                      {ed.error && (
                        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {ed.error}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => saveTemplate(def.trigger)}
                          disabled={ed.saving || !ed.dirty}
                          className="flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {ed.saving ? "Saving…" : "Save template"}
                        </button>

                        <button
                          type="button"
                          onClick={() => previewHtml(def.trigger)}
                          disabled={!ed.html || ed.previewing}
                          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {ed.previewing ? "Opening…" : "Preview"}
                        </button>

                        {custom && (
                          <button
                            type="button"
                            onClick={() => resetTemplate(def.trigger)}
                            className="flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset to default
                          </button>
                        )}
                      </div>

                      {/* Saved badge */}
                      {!ed.dirty && custom && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Custom template saved —{" "}
                          {new Date(custom.updated_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Migration note */}
      <details className="rounded-lg border border-dashed border-gray-200 p-4 text-xs text-gray-500">
        <summary className="cursor-pointer font-medium select-none">Setup note (Supabase migration)</summary>
        <pre className="mt-3 bg-gray-950 text-green-300 rounded p-3 overflow-x-auto leading-relaxed">{`-- Run this once in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS public.email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  trigger      TEXT NOT NULL,
  subject      TEXT NOT NULL,
  html_body    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, trigger)
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members can manage their templates"
  ON public.email_templates
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid()
  ));`}</pre>
      </details>
    </div>
  );
}
