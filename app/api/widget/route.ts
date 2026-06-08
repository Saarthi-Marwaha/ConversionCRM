/**
 * GET /api/widget?api_key=ccrm_xxx
 *
 * Serves the compiled tracking widget JS file.
 * The customer embeds: <script src="https://app.conversioncrm.io/api/widget?api_key=ccrm_xxx"></script>
 *
 * This route returns the widget script with the API key baked in,
 * so the customer doesn't need to set it twice.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get("api_key") ?? "";

  if (!apiKey.startsWith("ccrm_")) {
    return new NextResponse("// ConversionCRM: invalid api_key", {
      status: 400,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io";

  // Inline the widget script with the resolved API key and endpoint
  const script = buildWidgetScript({ apiKey, endpoint: `${appUrl}/api/events` });

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildWidgetScript({
  apiKey,
  endpoint,
}: {
  apiKey: string;
  endpoint: string;
}): string {
  // The widget is a self-contained IIFE.
  // It exposes window.ccrm.track(event, properties) and window.ccrm.identify(userId, traits).
  return `
(function() {
  if (window.__ccrm_loaded) return;
  window.__ccrm_loaded = true;

  var API_KEY = ${JSON.stringify(apiKey)};
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var userId = null;
  var userEmail = null;
  var userName = null;

  function send(event, properties) {
    if (!userId) return;
    var payload = {
      api_key: API_KEY,
      user_id: userId,
      email: userEmail,
      name: userName,
      event: event,
      properties: properties || {},
      timestamp: new Date().toISOString()
    };
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function() {});
    }
  }

  window.ccrm = {
    /**
     * Identify the current user.
     * Call this after login with the user's ID and optional traits.
     */
    identify: function(id, traits) {
      userId = String(id);
      if (traits) {
        userEmail = traits.email || null;
        userName = traits.name || null;
      }
      send('login', traits || {});
    },

    /**
     * Track a custom event.
     */
    track: function(event, properties) {
      send(event, properties);
    },

    /**
     * Track a page view. Call on route changes in SPAs.
     */
    page: function(name, properties) {
      send('page_view', Object.assign({ page: name || window.location.pathname }, properties || {}));
    }
  };

  // Auto-track page views (works for MPA; SPA should call ccrm.page() manually)
  if (typeof window !== 'undefined') {
    window.ccrm.page();
  }
})();
`.trim();
}
