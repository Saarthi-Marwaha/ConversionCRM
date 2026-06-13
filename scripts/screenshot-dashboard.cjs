/**
 * scripts/screenshot-dashboard.cjs
 *
 * Captures a crisp 2x screenshot of the real Live Overview dashboard with
 * polished demo data (network-intercepted, nothing written to the DB) for
 * the landing-page hero. Output: ../lpf/assets/dashboard.png
 *
 * Usage: node scripts/screenshot-dashboard.cjs  (dev server must be running)
 */
const path = require("path");
const puppeteer = require("puppeteer-core");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = path.resolve(__dirname, "..", "..", "lpf", "assets", "dashboard.png");

const now = Date.now();
const minsAgo = (m) => new Date(now - m * 60 * 1000).toISOString();

function user(o) {
  return {
    country: null,
    region: null,
    emails_sent: {},
    score_breakdown: {
      recency: 16, frequency: 12, depth: 10, key_feature: 14,
      time_spent: 9, buying_intent: 7, total_seconds: 1200,
      active_days: 3, distinct_pages: 6, total: o.engagement_score,
    },
    events: Math.round(o.total_clicks * 2.4),
    first_seen: minsAgo(60 * 24 * 6),
    last_event: "page_view",
    last_page: "/app",
    signed_up: true,
    logged_in: true,
    is_anonymous: false,
    pages: [],
    page_count: 6,
    activity: [],
    ...o,
  };
}

const USERS = [
  user({ user_id: "usr_8f3ka92mqp", email: "maya@lumenapp.io", stage: "conversion_ready", engagement_score: 86, total_clicks: 214, total_time_seconds: 5460, last_seen: minsAgo(2) }),
  user({ user_id: "usr_2cd91xkv44", email: "dev@stackmetrics.co", stage: "active", engagement_score: 64, total_clicks: 158, total_time_seconds: 3890, last_seen: minsAgo(11) }),
  user({ user_id: "usr_b77pe01nds", email: "riya@flowdesk.io", stage: "paid", engagement_score: 91, total_clicks: 342, total_time_seconds: 9120, last_seen: minsAgo(26) }),
  user({ user_id: "usr_5mt38qzwhc", email: "ana@parsel.app", stage: "onboarding", engagement_score: 28, total_clicks: 41, total_time_seconds: 760, last_seen: minsAgo(49) }),
  user({ user_id: "usr_kk04hr77ab", email: "tom@quietmail.dev", stage: "going_quiet", engagement_score: 12, total_clicks: 9, total_time_seconds: 180, last_seen: minsAgo(60 * 26) }),
  user({ user_id: "usr_9wq12bnm3e", email: "jonas@brightkit.de", stage: "active", engagement_score: 57, total_clicks: 122, total_time_seconds: 2940, last_seen: minsAgo(74) }),
  user({ user_id: "usr_qa83lcv0zu", email: "sofia@metricly.app", stage: "conversion_ready", engagement_score: 78, total_clicks: 196, total_time_seconds: 4410, last_seen: minsAgo(95) }),
  user({ user_id: "usr_x1f76ydj28", email: "leo@shipwave.dev", stage: "signup", engagement_score: 8, total_clicks: 4, total_time_seconds: 95, last_seen: minsAgo(60 * 3) }),
];

const LIVE = {
  workspace: { id: "demo", name: "Acme Inc.", website_url: "https://acme.com", reply_to_configured: true },
  range: "7d",
  filtered: true,
  emailBatch: { sent: 0, errors: [] },
  users: USERS,
  totals: {
    users: 2847, events: 96231, anonymousEvents: 1204, pageViews: 48230,
    totalClicks: 96412, identified: 2214, totalTimeSeconds: 1126800,
  },
  serverTime: new Date().toISOString(),
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=2"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 860, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/dashboard/live")) {
      return req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(LIVE),
      });
    }
    req.continue();
  });

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("tbody tr", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));

  // Clean shot: no floating widget, demo workspace name
  await page.evaluate(() => {
    document.querySelectorAll("button.fixed").forEach((b) => b.remove());
    document.querySelectorAll("aside span, header span").forEach((s) => {
      if (s.textContent.trim() === "Test Workspace") s.textContent = "Acme Inc.";
    });
  });
  await new Promise((r) => setTimeout(r, 300));

  await page.screenshot({ path: OUT, type: "png" });
  await browser.close();
  console.log("saved:", OUT);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
