/**
 * POST /api/events
 *
 * Public event-ingestion endpoint hit by the embeddable widget.
 * Authenticated by `api_key` in the request body (no login session needed).
 *
 * Body: { api_key, event_type, page?, user_id?, properties?, timestamp? }
 *
 *  200 — event stored
 *  400 — api_key missing / invalid JSON
 *  401 — api_key doesn't match any workspace
 *  413 — body too large
 *  429 — too many events from this api_key
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  isSignupEventType,
  maybeSendWelcomeOnSignup,
} from "@/lib/emails/send-welcome";
import { recordLimitSignalIfApplicable } from "@/lib/emails/record-limit-signal";

// CORS so the widget can POST from any customer domain
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
};

const MAX_BODY_BYTES = 32 * 1024;
const MAX_PROPERTIES_BYTES = 8 * 1024;

// Best-effort per-instance rate limiting: a single api_key gets at most
// 240 events per minute. Serverless instances each keep their own window,
// so this is a soft cap — enough to blunt floods without a shared store.
const RATE_LIMIT_PER_MIN = 240;
const rateWindows = new Map<string, { start: number; count: number }>();

function rateLimited(apiKey: string): boolean {
  const now = Date.now();
  const win = rateWindows.get(apiKey);
  if (!win || now - win.start > 60_000) {
    rateWindows.set(apiKey, { start: now, count: 1 });
    // Opportunistic cleanup so the map can't grow unbounded.
    if (rateWindows.size > 5000) {
      Array.from(rateWindows.entries()).forEach(([k, v]) => {
        if (now - v.start > 60_000) rateWindows.delete(k);
      });
    }
    return false;
  }
  win.count++;
  return win.count > RATE_LIMIT_PER_MIN;
}

function asTrimmedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client timestamps are honored only within a sane window; else now. */
function safeTimestamp(value: unknown): string {
  const now = Date.now();
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const fiveMinAhead = now + 5 * 60 * 1000;
    if (Number.isFinite(t) && t >= thirtyDaysAgo && t <= fiveMinAhead) {
      return new Date(t).toISOString();
    }
  }
  return new Date(now).toISOString();
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Parse body: the widget sends Content-Type text/plain with a JSON body
  // (text/plain is a CORS-safelisted type — no preflight needed). We read
  // the raw text first and JSON.parse manually so the content-type header
  // never causes a body-parser rejection.
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Body too large" },
        { status: 413, headers: CORS_HEADERS }
      );
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const apiKey = asTrimmedString(body.api_key, 128);
  if (!apiKey) {
    return NextResponse.json(
      { error: "api_key is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (rateLimited(apiKey)) {
    return NextResponse.json(
      { error: "Too many events, slow down" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  // Capture the origin of the request so we can filter by website on the
  // dashboard. Prefer the Origin header; fall back to the Referer host.
  const rawOrigin =
    request.headers.get("origin") ||
    (() => {
      const ref = request.headers.get("referer") ?? "";
      try {
        return ref ? new URL(ref).origin : "";
      } catch {
        return "";
      }
    })();
  const origin = rawOrigin ? rawOrigin.slice(0, 256) : null;

  // Geo from the edge: Vercel resolves visitor IP → country/region/city and
  // forwards them as headers (Cloudflare fallback for country). No IP is
  // ever stored — only the coarse location, like any analytics tool.
  const country = (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    ""
  )
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const regionHeader = request.headers.get("x-vercel-ip-country-region") ?? "";
  const cityHeader = request.headers.get("x-vercel-ip-city") ?? "";
  const safeDecode = (v: string) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const geo = {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    region: regionHeader ? safeDecode(regionHeader).slice(0, 64) : null,
    city: cityHeader ? safeDecode(cityHeader).slice(0, 128) : null,
  };

  const supabase = createSupabaseAdminClient();

  // Look up the workspace this api_key belongs to
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, reply_to_email")
    .eq("api_key", apiKey)
    .maybeSingle();

  // Every workspace has its own real api_key (issued at onboarding) —
  // unknown keys are rejected outright, no test-workspace fallback.
  if (!workspace?.id) {
    return NextResponse.json(
      { error: "Unknown api_key" },
      { status: 401, headers: CORS_HEADERS }
    );
  }
  const workspaceId = workspace.id;

  const eventType = asTrimmedString(body.event_type, 64) ?? "page_view";
  const userId = asTrimmedString(body.user_id, 128);
  const page = asTrimmedString(body.page, 500);

  // Properties: must be a plain object and small enough to store.
  let props: Record<string, unknown> = {};
  if (
    body.properties &&
    typeof body.properties === "object" &&
    !Array.isArray(body.properties)
  ) {
    const candidate = body.properties as Record<string, unknown>;
    try {
      if (JSON.stringify(candidate).length <= MAX_PROPERTIES_BYTES) {
        props = candidate;
      }
    } catch {
      // circular / unserializable — drop
    }
  }

  // Email can come top-level or nested in properties.email
  const rawEmail =
    asTrimmedString(body.email, 320) ?? asTrimmedString(props.email, 320);
  const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : null;

  const { error } = await supabase.from("events").insert({
    workspace_id: workspaceId,
    user_id: userId,
    event_type: eventType,
    event_name: eventType,
    email,
    page,
    origin,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    properties: props,
    occurred_at: safeTimestamp(body.timestamp),
  });

  if (error) {
    console.error("[/api/events] insert failed:", error.message, error.code);
    return NextResponse.json(
      { error: "Failed to store event" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (userId && isSignupEventType(eventType) && email) {
    void maybeSendWelcomeOnSignup(workspaceId, userId, email).catch((err) => {
      console.error("[/api/events] welcome email:", err);
    });
  }

  if (userId) {
    void recordLimitSignalIfApplicable(
      workspaceId,
      userId,
      eventType,
      props
    ).catch((err) => {
      console.error("[/api/events] limit signal:", err);
    });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}
