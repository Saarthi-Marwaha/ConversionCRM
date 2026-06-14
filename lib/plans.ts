/**
 * ConversionCRM — plan catalogue (single source of truth).
 *
 * Dependency-free so it can be imported from the edge middleware, server
 * routes, and client components alike.
 *
 * ── PRICING & MARGIN (target: ≥50% gross profit) ──────────────────────
 * Our only variable cost is outbound email (Resend, transactional).
 * Resend's real cost to us (from resend.com/pricing?product=transactional):
 *   Free  $0   3,000/mo  ·  Pro $20  50,000/mo  ·  Scale $90  100,000/mo
 *   overage $0.90 / 1,000 emails  ·  Enterprise custom
 *
 *     volume        Resend cost     our price     gross margin
 *     ───────────────────────────────────────────────────────────
 *       1,000          $0             $0          — (free)
 *      15,000          ~$6–13         $20         ~50–70% (pooled)
 *     100,000          $90            $180        50%
 *     200,000          $180           $360        50%
 *     500,000          $450           $900        50%
 *   1,000,000          $900           $1,800      50%
 *   1,500,000          $1,350         $2,700      50%
 *   2,500,000          $2,250         $4,500      50%
 *   2,500,000+         custom         Contact us  —
 *
 * Price = 2 × Resend cost ⇒ a clean 50% gross margin at every paid step.
 * (Pro is $180, not $150 — at Resend's $90/100k, $150 would be only 40%.)
 */

export type PlanId = "free" | "basic" | "pro" | "premium" | "enterprise";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in USD. `null` = custom / contact sales. */
  priceUsd: number | null;
  /** Base monthly email-send cap (before rollover). */
  emailQuota: number;
  /** Short marketing line. */
  blurb: string;
  recommended?: boolean;
  /** Feature bullets shown with a check. */
  features: string[];
  /** Bullets shown crossed-out (not in this plan). */
  notIncluded?: string[];
  /** Capability keys this plan unlocks (see lib/entitlements). */
  entitlements: Entitlement[];
  /** Env var holding the matching Razorpay plan_id (paid plans only). */
  razorpayPlanEnv?: string;
}

export type Entitlement =
  | "automated_emails"
  | "custom_composer"
  | "custom_smtp"
  | "api_access"
  | "unlimited_sites"
  | "priority_access";

export const SALES_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL || "ceo.conversioncrm@gmail.com";

// Tracking (snippet/widget), live overview, the users table and an API key
// are available on EVERY plan — they're how data gets collected, never gated.
const ALWAYS_ON: Entitlement[] = ["api_access"];

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    emailQuota: 1_000,
    blurb: "Track every signup and watch them activate, live.",
    features: [
      "1,000 emails / month",
      "Tracking snippet & live overview",
      "Full users table & profiles",
      "6-layer engagement scoring & stages",
      "API key access",
    ],
    notIncluded: [
      "Automated lifecycle emails",
      "Custom sending domain (SMTP)",
      "Email composer (custom HTML)",
    ],
    entitlements: [...ALWAYS_ON],
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceUsd: 20,
    emailQuota: 15_000,
    blurb: "Convert signups with automated lifecycle emails.",
    features: [
      "15,000 emails / month",
      "Everything in Free",
      "Automated lifecycle emails",
      "Custom sending domain (SMTP)",
      "Full users table & API access",
      "30-day event history",
    ],
    notIncluded: ["Email composer (custom HTML)"],
    entitlements: [...ALWAYS_ON, "automated_emails", "custom_smtp"],
    razorpayPlanEnv: "RAZORPAY_PLAN_BASIC",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 180,
    emailQuota: 100_000,
    blurb: "Everything unlocked — including the custom HTML composer.",
    recommended: true,
    features: [
      "100,000 emails / month",
      "Everything in Basic",
      "Email composer (custom HTML)",
      "All features unlocked",
      "Custom sending domain (SMTP)",
      "90-day event history",
    ],
    entitlements: [
      ...ALWAYS_ON,
      "automated_emails",
      "custom_smtp",
      "custom_composer",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceUsd: 360,
    emailQuota: 200_000,
    blurb: "Serious scale with priority access.",
    features: [
      "200,000 emails / month",
      "Everything in Pro",
      "Unlimited websites / workspaces",
      "Priority access",
      "1-year event history",
    ],
    entitlements: [
      ...ALWAYS_ON,
      "automated_emails",
      "custom_smtp",
      "custom_composer",
      "unlimited_sites",
      "priority_access",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_PREMIUM",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: null,
    emailQuota: 5_000_000,
    blurb: "Custom volume, infrastructure and pricing.",
    features: [
      "2.5M+ emails / month",
      "Everything in Premium",
      "Custom volume & pricing",
      "Dedicated infrastructure",
      "Priority access",
    ],
    entitlements: [
      ...ALWAYS_ON,
      "automated_emails",
      "custom_smtp",
      "custom_composer",
      "unlimited_sites",
      "priority_access",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = [
  "free",
  "basic",
  "pro",
  "premium",
  "enterprise",
];

export function planById(id: string | null | undefined): PlanDef {
  return (id && PLANS[id as PlanId]) || PLANS.free;
}

/** True when `a` is the same or a higher tier than `b`. */
export function planAtLeast(a: PlanId, b: PlanId): boolean {
  return PLAN_ORDER.indexOf(a) >= PLAN_ORDER.indexOf(b);
}

/** The plans the customer can buy directly (Razorpay). */
export const PURCHASABLE_PLANS: PlanId[] = ["basic", "pro", "premium"];

/**
 * The volume slider used on the pricing page. Each stop maps a monthly email
 * volume to its price (2× Resend cost ⇒ 50% margin) and the plan it implies.
 * Volumes above Premium's 200k are quoted but routed to sales (Contact us).
 */
export interface VolumeStop {
  emails: number;
  /** Indicative monthly price (USD). `null` = custom. */
  priceUsd: number | null;
  plan: PlanId;
  /** Whether this stop is bought self-serve or routed to sales. */
  contactSales?: boolean;
}

export const VOLUME_STOPS: VolumeStop[] = [
  { emails: 1_000, priceUsd: 0, plan: "free" },
  { emails: 15_000, priceUsd: 20, plan: "basic" },
  { emails: 100_000, priceUsd: 180, plan: "pro" },
  { emails: 200_000, priceUsd: 360, plan: "premium" },
  { emails: 500_000, priceUsd: 900, plan: "premium", contactSales: true },
  { emails: 1_000_000, priceUsd: 1_800, plan: "premium", contactSales: true },
  { emails: 1_500_000, priceUsd: 2_700, plan: "premium", contactSales: true },
  { emails: 2_500_000, priceUsd: 4_500, plan: "premium", contactSales: true },
  { emails: 3_000_000, priceUsd: null, plan: "enterprise", contactSales: true },
];

export function formatEmails(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}

export function formatPrice(p: number | null): string {
  if (p === null) return "Custom";
  return `$${p.toLocaleString("en-US")}`;
}
