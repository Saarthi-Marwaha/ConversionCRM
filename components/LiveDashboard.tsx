"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { EmailTrigger, LifecycleStage } from "@/types";
import type { WeeklyScoreBreakdown } from "@/lib/scoring";
import type { UserEmailsSent } from "@/lib/emails/stage-email-columns";
import {
  Users,
  Eye,
  MousePointerClick,
  ChevronRight,
  Clock,
  Check,
  Search,
} from "lucide-react";

type ClickTarget = { label: string; count: number };

type PageStats = {
  page: string;
  title: string | null;
  views: number;
  time_seconds: number;
  clicks: number;
  click_targets: ClickTarget[];
};

type UserActivity = {
  event_type: string;
  page: string | null;
  occurred_at: string;
  detail: string | null;
};

export type DashboardDateRange = "today" | "7d" | "30d";

const RANGE_STORAGE_KEY = "ccrm-dashboard-range";
const NAVY = "text-[#0b3a5e]";

const STAGE_BADGE: Record<LifecycleStage, { label: string; class: string }> = {
  signup: { label: "Signup", class: "bg-sky-100 text-sky-900" },
  onboarding: { label: "Onboarding", class: "bg-sky-50 text-sky-700" },
  active: { label: "Active", class: "bg-sky-500 text-white" },
  going_quiet: { label: "Going Quiet", class: "bg-white text-gray-600 shadow-soft" },
  conversion_ready: { label: "Ready", class: "bg-[#0b3a5e] text-white" },
  paid: { label: "Paid", class: "bg-gray-900 text-white" },
  churned: { label: "Churned", class: "bg-gray-100 text-gray-500" },
};

function rangeLabel(range: DashboardDateRange): string {
  switch (range) {
    case "today":
      return "Today";
    case "30d":
      return "Last 30 days";
    default:
      return "Last 7 days";
  }
}

function scorePeriodLabel(range: DashboardDateRange): string {
  switch (range) {
    case "today":
      return "Today's score";
    case "30d":
      return "30-day score";
    default:
      return "7-day score";
  }
}

type LiveUser = {
  user_id: string;
  email: string | null;
  country: string | null;
  region: string | null;
  stage: LifecycleStage;
  emails_sent: UserEmailsSent;
  engagement_score: number;
  score_breakdown: WeeklyScoreBreakdown;
  events: number;
  first_seen: string;
  last_seen: string;
  last_event: string;
  last_page: string | null;
  signed_up: boolean;
  logged_in: boolean;
  is_anonymous: boolean;
  total_time_seconds: number;
  total_clicks: number;
  pages: PageStats[];
  page_count: number;
  activity: UserActivity[];
};

type LiveData = {
  workspace: {
    id: string;
    name: string;
    website_url: string | null;
    reply_to_configured?: boolean;
  };
  range: DashboardDateRange;
  filtered: boolean;
  emailBatch?: { sent: number; errors: string[] };
  users: LiveUser[];
  totals: {
    users: number;
    events: number;
    anonymousEvents: number;
    pageViews: number;
    totalClicks: number;
    identified: number;
    totalTimeSeconds: number;
  };
  serverTime: string;
};

export function userDetailHref(userId: string): string {
  return `/dashboard/users/${encodeURIComponent(userId)}`;
}

/** "US" → 🇺🇸 via regional indicator symbols. */
function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function RegionCell({ user }: { user: LiveUser }) {
  if (!user.country) return <span className="text-gray-300">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-gray-700 whitespace-nowrap"
      title={user.region ? `${user.region}, ${user.country}` : user.country}
    >
      <span aria-hidden>{countryFlag(user.country)}</span>
      {user.country}
      {user.region ? (
        <span className="text-gray-400">· {user.region}</span>
      ) : null}
    </span>
  );
}

function ScoreBadge({
  score,
  periodLabel = "7-day score",
}: {
  score: number;
  periodLabel?: string;
}) {
  const tier =
    score >= 70
      ? "bg-[#0b3a5e] text-white"
      : score >= 40
        ? "bg-sky-100 text-sky-900"
        : "bg-gray-100 text-gray-600";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
        tier
      )}
      title={`Engagement score (${periodLabel}): ${score}/100`}
    >
      {score}
    </span>
  );
}

function StageBadge({ stage }: { stage: LifecycleStage }) {
  const badge = STAGE_BADGE[stage] ?? STAGE_BADGE.signup;
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
        badge.class
      )}
    >
      {badge.label}
    </span>
  );
}

function DateRangeToggle({
  range,
  onChange,
}: {
  range: DashboardDateRange;
  onChange: (range: DashboardDateRange) => void;
}) {
  const options: { value: DashboardDateRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
  ];

  return (
    <div className="inline-flex items-center rounded-lg bg-white shadow-soft p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
            range === opt.value
              ? "bg-sky-500 text-white"
              : "text-gray-500 hover:text-gray-800"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function useDateRange() {
  const [range, setRange] = useState<DashboardDateRange>("7d");

  useEffect(() => {
    const stored = localStorage.getItem(RANGE_STORAGE_KEY);
    if (stored === "today" || stored === "7d" || stored === "30d") {
      setRange(stored);
    }
  }, []);

  const setAndStore = useCallback((next: DashboardDateRange) => {
    setRange(next);
    localStorage.setItem(RANGE_STORAGE_KEY, next);
  }, []);

  return [range, setAndStore] as const;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

const POLL_MS = 5000;

function useLiveData(range: DashboardDateRange) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoaded = useRef(false);

  const fetchData = useCallback(async () => {
    // Always load once; after that, don't burn requests while the tab is
    // in the background (visibilitychange refreshes on return).
    if (
      hasLoaded.current &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      return;
    }
    hasLoaded.current = true;
    try {
      const res = await fetch(`/api/dashboard/live?range=${range}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LiveData;
      setData(json);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    timer.current = setInterval(fetchData, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  return { data, error, updatedAt };
}

function LiveBadge({ updatedAt }: { updatedAt: Date | null }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-800 bg-sky-50 px-2.5 py-1 rounded-full">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
      </span>
      Live
      {updatedAt && (
        <span className="text-sky-600/70 font-normal hidden sm:inline">
          · {updatedAt.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-4 sm:p-5 shadow-soft",
        highlight ? "bg-sky-100" : "bg-sky-50"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-sky-900">{label}</p>
        <Icon className="h-4 w-4 text-sky-400" />
      </div>
      <p
        className={cn(
          "text-xl sm:text-2xl font-bold mt-1.5 tabular-nums",
          NAVY
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Activation funnel ───────────────────────────────────────
 * Splits conversion into its two honest halves so the customer can see which
 * one is leaking: signups → activated (their onboarding's job) and
 * activated → paid (the moment-timing job ConversionCRM owns). Computed from
 * the live user stages — no extra request.
 */
function ActivationFunnel({ users }: { users: LiveUser[] | null }) {
  if (!users) {
    return (
      <div className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Activation funnel</h2>
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  // Only identified signups belong in a signup→paid funnel; anonymous
  // visitors haven't signed up, so counting them would unfairly tank the
  // activation rate and wrongly blame onboarding.
  const signups = users.filter((u) => !u.is_anonymous);
  const n = signups.length;

  if (n === 0) {
    return (
      <div className="card p-5 sm:p-6 space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Activation funnel</h2>
        <p className="text-sm text-gray-500">
          No identified signups yet. Call{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">identify()</code>{" "}
          after login so ConversionCRM can map your{" "}
          <strong>signup → activated → paid</strong> funnel and show exactly
          where users drop off.
        </p>
      </div>
    );
  }

  const isActivated = (s: LifecycleStage) =>
    s === "active" || s === "conversion_ready" || s === "paid";

  const activated = signups.filter((u) => isActivated(u.stage)).length;
  const ready = signups.filter(
    (u) => u.stage === "conversion_ready" || u.stage === "paid"
  ).length;
  const paid = signups.filter((u) => u.stage === "paid").length;
  const stillOnboarding = signups.filter(
    (u) => u.stage === "signup" || u.stage === "onboarding"
  ).length;
  const slipped = signups.filter(
    (u) => u.stage === "going_quiet" || u.stage === "churned"
  ).length;

  const pct = (x: number) => Math.round((x / n) * 100);
  const activationRate = pct(activated);
  const activatedToPaid = activated > 0 ? Math.round((paid / activated) * 100) : 0;

  const steps = [
    { label: "Signups", count: n, bar: "bg-sky-200 text-sky-900", desc: "Identified users" },
    { label: "Activated", count: activated, bar: "bg-sky-400 text-white", desc: "Reached the aha moment" },
    { label: "Conversion-ready", count: ready, bar: "bg-sky-600 text-white", desc: "Score 70+ with intent" },
    { label: "Paid", count: paid, bar: "bg-[#0b3a5e] text-white", desc: "Upgraded to paid" },
  ];

  const dropToActivation = n - activated; // onboarding's responsibility
  const dropAfterActivation = activated - paid; // timing's responsibility

  let verdict: { tone: "warn" | "ok"; text: React.ReactNode };
  if (activated === 0) {
    verdict = {
      tone: "warn",
      text: (
        <>
          No signups have hit their aha moment yet. The bottleneck is{" "}
          <strong>activation (your onboarding flow)</strong>, not email timing —
          outreach can&apos;t convert users who never saw value.
        </>
      ),
    };
  } else if (dropToActivation === 0 && dropAfterActivation === 0) {
    verdict = {
      tone: "ok",
      text: (
        <>
          Every identified signup has activated <em>and</em> converted to paid.
          Nothing is leaking right now — keep doing what you&apos;re doing.
        </>
      ),
    };
  } else if (dropToActivation >= dropAfterActivation) {
    verdict = {
      tone: "warn",
      text: (
        <>
          Your biggest leak is <strong>before activation</strong>:{" "}
          {pct(dropToActivation)}% of signups haven&apos;t reached their aha
          moment. That points to <strong>onboarding</strong>, not outreach — fix
          activation first.
        </>
      ),
    };
  } else {
    verdict = {
      tone: "ok",
      text: (
        <>
          Activation looks healthy. Your biggest leak is{" "}
          <strong>after activation</strong>: {dropAfterActivation} activated
          user{dropAfterActivation === 1 ? "" : "s"} haven&apos;t converted yet —
          exactly where behavior-triggered <strong>timing</strong> moves the
          needle.
        </>
      ),
    };
  }

  const benchmark =
    activationRate >= 30
      ? { label: "Healthy", class: "bg-emerald-50 text-emerald-700" }
      : activationRate >= 20
        ? { label: "Average", class: "bg-amber-50 text-amber-700" }
        : { label: "Needs work", class: "bg-red-50 text-red-700" };

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Activation funnel</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Where your signups are right now — is the leak onboarding or timing?
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-2xl font-bold text-[#0b3a5e] tabular-nums">
              {activationRate}%
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                benchmark.class
              )}
            >
              {benchmark.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-400">activation rate · aim for 30%+</p>
        </div>
      </div>

      {/* Funnel bars */}
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const widthPct = Math.max(pct(s.count), 6);
          const prev = i === 0 ? null : steps[i - 1].count;
          const drop = prev !== null && prev > 0 ? prev - s.count : 0;
          const dropPct =
            prev !== null && prev > 0 ? Math.round((drop / prev) * 100) : 0;
          return (
            <div key={s.label}>
              {i > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-gray-400 pl-1 mb-1">
                  <span className="text-gray-300">&#8627;</span>
                  {drop > 0 ? (
                    <span>
                      &minus;{drop} dropped ({dropPct}%)
                    </span>
                  ) : (
                    <span>no drop-off</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-800">{s.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    {s.desc}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "h-8 rounded-md flex items-center px-2.5 transition-all duration-500",
                      s.bar
                    )}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-xs font-bold tabular-nums">
                      {s.count}
                    </span>
                  </div>
                </div>
                <span className="w-10 text-right text-xs font-semibold text-gray-500 tabular-nums flex-shrink-0">
                  {pct(s.count)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnostic verdict — the whole point: assign the leak honestly */}
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-xs leading-relaxed",
          verdict.tone === "warn"
            ? "bg-amber-50 text-amber-900"
            : "bg-emerald-50 text-emerald-900"
        )}
      >
        {verdict.text}
      </div>

      {/* Composition footnote */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        <span>
          Still onboarding:{" "}
          <strong className="text-gray-600">{stillOnboarding}</strong>
        </span>
        <span>
          Slipped (quiet/churned):{" "}
          <strong className="text-gray-600">{slipped}</strong>
        </span>
        <span>
          Activated &rarr; paid:{" "}
          <strong className="text-gray-600">{activatedToPaid}%</strong>
        </span>
      </div>
    </div>
  );
}

function Banners({ data }: { data: LiveData | null }) {
  if (!data) return null;
  return (
    <>
      {!data.filtered && (
        <div className="bg-sky-50 rounded-lg px-4 py-2.5 text-xs text-[#0b3a5e] shadow-soft">
          No website configured — showing all events.{" "}
          <a href="/dashboard/settings" className="underline hover:text-sky-900">
            Set your website URL in Settings
          </a>
        </div>
      )}
      {data.emailBatch && data.emailBatch.sent > 0 && (
        <div className="flex items-center gap-2 bg-sky-50 rounded-lg px-4 py-2.5 text-xs text-[#0b3a5e] shadow-soft">
          <Check className="h-3.5 w-3.5" />
          Sent {data.emailBatch.sent} automated email
          {data.emailBatch.sent === 1 ? "" : "s"} this session.
        </div>
      )}
      {data.workspace.reply_to_configured === false && (
        <div className="bg-sky-50 rounded-lg px-4 py-2.5 text-xs text-[#0b3a5e] shadow-soft">
          Add your reply-to email in{" "}
          <a href="/dashboard/settings" className="underline">
            Settings
          </a>{" "}
          to enable automated emails.
        </div>
      )}
    </>
  );
}

/* ── Mobile card list (shared) ───────────────────────────── */
function UserCardList({ users }: { users: LiveUser[] }) {
  const router = useRouter();
  return (
    <ul className="divide-y divide-gray-50 sm:hidden">
      {users.map((u) => (
        <li key={u.user_id}>
          <button
            type="button"
            onClick={() => router.push(userDetailHref(u.user_id))}
            className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-sky-50 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(u.email ?? u.user_id).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {u.email ?? u.user_id}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {u.country ? `${countryFlag(u.country)} ${u.country} · ` : ""}
                {u.total_clicks} clicks ·{" "}
                {u.total_time_seconds > 0
                  ? formatDuration(u.total_time_seconds)
                  : "0s"}{" "}
                · {formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <ScoreBadge score={u.engagement_score} />
              <StageBadge stage={u.stage} />
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── Overview ────────────────────────────────────────────── */
export function LiveDashboard() {
  const [range, setRange] = useDateRange();
  const { data, error, updatedAt } = useLiveData(range);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Live Overview
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time activity · {rangeLabel(data?.range ?? range)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangeToggle range={range} onChange={setRange} />
          <LiveBadge updatedAt={updatedAt} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 shadow-soft">
          Couldn&apos;t reach the live feed: {error}
        </div>
      )}

      <Banners data={data} />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Metric
          label="Tracked Users"
          value={data?.totals.users ?? "—"}
          icon={Users}
          highlight
        />
        <Metric
          label="Page Views"
          value={data ? formatCompact(data.totals.pageViews) : "—"}
          icon={Eye}
        />
        <Metric
          label="Total Clicks"
          value={data ? formatCompact(data.totals.totalClicks) : "—"}
          icon={MousePointerClick}
        />
        <Metric
          label="Time On Site"
          value={
            data?.totals.totalTimeSeconds
              ? formatDuration(data.totals.totalTimeSeconds)
              : "—"
          }
          icon={Clock}
        />
      </div>

      <ActivationFunnel users={data?.users ?? null} />

      <OverviewUsersTable
        users={data?.users ?? null}
        scorePeriodLabel={scorePeriodLabel(data?.range ?? range)}
      />
    </div>
  );
}

/**
 * Overview table — the six glanceable columns. Tap or click a row to open
 * the user's full profile.
 */
function OverviewUsersTable({
  users,
  scorePeriodLabel = "7-day score",
}: {
  users: LiveUser[] | null;
  scorePeriodLabel?: string;
}) {
  const router = useRouter();

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Tracked users</h2>
        <span className="text-xs text-gray-400 truncate">
          {users ? `${users.length} total · ` : ""}tap a user for the full
          profile
        </span>
      </div>

      {!users && (
        <p className="px-4 py-12 text-center text-sm text-gray-400">Loading…</p>
      )}

      {users && users.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-gray-400">
            No users tracked yet. Trigger an event from the widget and it will
            appear here within a few seconds.
          </p>
        </div>
      )}

      {users && users.length > 0 && (
        <>
          <UserCardList users={users} />

          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-500 text-left text-xs font-semibold text-white">
                  <th className="px-4 py-3 font-semibold">Tracked User Id</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Total Clicks
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Time Spent
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Score / 100
                  </th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => router.push(userDetailHref(u.user_id))}
                    title="Open full profile"
                    className="cursor-pointer transition-colors hover:bg-sky-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate max-w-[11rem] font-mono text-xs">
                          {u.user_id}
                        </span>
                        {u.is_anonymous && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            anon
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.email ? (
                        <span className="truncate max-w-[13rem] inline-block align-bottom">
                          {u.email}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RegionCell user={u} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {u.total_clicks > 0 ? u.total_clicks : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 text-xs tabular-nums whitespace-nowrap">
                      {u.total_time_seconds > 0
                        ? formatDuration(u.total_time_seconds)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge
                        score={u.engagement_score}
                        periodLabel={scorePeriodLabel}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={u.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Users page ──────────────────────────────────────────── */
type SortKey = "last_seen" | "score" | "status" | "clicks" | "time";

const STAGE_SORT_ORDER: Record<LifecycleStage, number> = {
  paid: 0,
  conversion_ready: 1,
  active: 2,
  onboarding: 3,
  signup: 4,
  going_quiet: 5,
  churned: 6,
};

export function LiveUsersPanel() {
  const [range, setRange] = useDateRange();
  const { data, error, updatedAt } = useLiveData(range);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last_seen");
  const periodLabel = scorePeriodLabel(data?.range ?? range);

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    let list = data.users;
    if (q) {
      list = list.filter(
        (u) =>
          u.user_id.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case "score":
        sorted.sort((a, b) => b.engagement_score - a.engagement_score);
        break;
      case "status":
        sorted.sort(
          (a, b) =>
            STAGE_SORT_ORDER[a.stage] - STAGE_SORT_ORDER[b.stage] ||
            b.engagement_score - a.engagement_score
        );
        break;
      case "clicks":
        sorted.sort((a, b) => b.total_clicks - a.total_clicks);
        break;
      case "time":
        sorted.sort((a, b) => b.total_time_seconds - a.total_time_seconds);
        break;
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        );
    }
    return sorted;
  }, [data, query, sortKey]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data
              ? `${data.totals.users} tracked · ${rangeLabel(data.range)}`
              : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangeToggle range={range} onChange={setRange} />
          <LiveBadge updatedAt={updatedAt} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md px-4 py-3 shadow-soft">
          Couldn&apos;t reach the live feed: {error}
        </div>
      )}

      <Banners data={data} />

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or user id…"
            className="w-full bg-white rounded-md shadow-soft pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-white rounded-md shadow-soft px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <option value="last_seen">Sort: Last seen</option>
          <option value="score">Sort: Score</option>
          <option value="status">Sort: Status</option>
          <option value="clicks">Sort: Clicks</option>
          <option value="time">Sort: Time spent</option>
        </select>
      </div>

      <LiveUsersTable users={filtered} scorePeriodLabel={periodLabel} />
    </div>
  );
}

function StatusBadges({ user }: { user: LiveUser }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.signed_up && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0b3a5e] text-white">
          Signed up
        </span>
      )}
      {user.logged_in && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-900">
          Logged in
        </span>
      )}
      {!user.signed_up && !user.logged_in && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          Visitor
        </span>
      )}
    </div>
  );
}

/**
 * Users table — plain rows, no inline expansion. Clicking a row opens the
 * user's full profile page (which has its own back button).
 */
export function LiveUsersTable({
  users,
  scorePeriodLabel = "7-day score",
}: {
  users: LiveUser[] | null;
  scorePeriodLabel?: string;
}) {
  const router = useRouter();

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Tracked users</h2>
        <span className="text-xs text-gray-400 truncate">
          {users ? `${users.length} shown · ` : ""}click a row for the full
          profile
        </span>
      </div>

      {!users && (
        <p className="px-4 py-12 text-center text-sm text-gray-400">Loading…</p>
      )}

      {users && users.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-gray-400">
            Nothing here — adjust the search, or trigger an event from the
            widget.
          </p>
        </div>
      )}

      {users && users.length > 0 && (
        <>
          <UserCardList users={users} />

          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-500 text-left text-xs font-semibold text-white">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-center">Score</th>
                  <th className="px-4 py-3 font-semibold text-right">Events</th>
                  <th className="px-4 py-3 font-semibold text-right">Time</th>
                  <th className="px-4 py-3 font-semibold text-right">Clicks</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr
                    key={user.user_id}
                    onClick={() => router.push(userDetailHref(user.user_id))}
                    title="Open full profile"
                    className="cursor-pointer transition-colors hover:bg-sky-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 font-medium truncate max-w-[14rem]">
                            {user.email ?? user.user_id}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono truncate max-w-[14rem]">
                            {user.user_id}
                          </p>
                        </div>
                        {user.is_anonymous && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                            anon
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RegionCell user={user} />
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={user.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadges user={user} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge
                        score={user.engagement_score}
                        periodLabel={scorePeriodLabel}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {user.events}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 text-xs tabular-nums whitespace-nowrap">
                      {user.total_time_seconds > 0
                        ? formatDuration(user.total_time_seconds)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {user.total_clicks > 0 ? user.total_clicks : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(user.last_seen), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
