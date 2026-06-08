/**
 * POST /api/events
 *
 * Ingests behavioral events from the customer's JS widget.
 * Authenticated via api_key in the request body.
 * No auth session required — this is a public endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceByApiKey } from "@/db/queries";
import { upsertEndUser, insertEvent } from "@/db/queries";
import type { Event } from "@/types";

const KNOWN_EVENT_TYPES: Record<string, Event["event_type"]> = {
  login: "login",
  feature_click: "feature_click",
  page_view: "page_view",
  pricing_page_visit: "pricing_page_visit",
  key_feature_used: "key_feature_used",
  file_uploaded: "file_uploaded",
  task_completed: "task_completed",
  upgrade_clicked: "upgrade_clicked",
};

const eventSchema = z.object({
  api_key: z.string().min(1),
  user_id: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
  event: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

// CORS headers so the widget can POST from any origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  const { api_key, user_id, email, name, event, properties, timestamp } =
    parsed.data;

  // Look up workspace by API key
  const workspace = await getWorkspaceByApiKey(api_key);
  if (!workspace) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // Upsert the end user (create if new, update last_seen if existing)
  const endUser = await upsertEndUser({
    workspaceId: workspace.id,
    externalId: user_id,
    email: email ?? `${user_id}@unknown.invalid`,
    name,
    metadata: {},
  });

  if (!endUser) {
    return NextResponse.json(
      { error: "Failed to upsert user" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Map the event name to a typed event_type (fall back to "custom")
  const eventType: Event["event_type"] =
    KNOWN_EVENT_TYPES[event] ??
    (workspace.key_feature_event === event ? "key_feature_used" : "custom");

  await insertEvent({
    workspaceId: workspace.id,
    endUserId: endUser.id,
    eventType,
    eventName: event,
    properties: properties ?? {},
    occurredAt: timestamp,
  });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
