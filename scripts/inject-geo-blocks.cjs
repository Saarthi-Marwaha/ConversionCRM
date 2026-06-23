/* One-off: inject a literal Q/A direct-answer block (GEO/AEO) + a
   SoftwareApplication JSON-LD block into the deployed compare & solutions
   slug pages under public/site. Idempotent — safe to re-run. */
const fs = require("fs");
const path = require("path");

const SITE = "https://www.conversioncrm.co";
const ROOT = path.join(__dirname, "..", "public", "site");

const targets = [
  "compare/customerio.html",
  "compare/appcues.html",
  "compare/pendo.html",
  "compare/userpilot.html",
  "compare/intercom.html",
  "compare/userflow.html",
  "solutions/b2b-saas.html",
  "solutions/startups.html",
  "solutions/product-managers.html",
  "solutions/developers.html",
  "solutions/fintech.html",
  "solutions/day-1-retention.html",
];

const ANSWER =
  "ConversionCRM is free-trial conversion software for SaaS. You add one script tag, and it tracks each user's behavior, scores their engagement 0–100 across six layers, assigns a lifecycle stage, and automatically sends behavior-triggered emails that move free users to paid — installed in about three minutes, free during beta.";

function answerBlock() {
  return `<section class="answer-block" style="padding:28px 0 0">
  <div class="container">
    <div style="border:1px solid #e3e9f0;border-radius:14px;padding:20px 22px;background:#f7fafd">
      <p style="margin:0 0 6px;font-weight:700;color:var(--blue-deep,#0b3a5e)">Q: What is ConversionCRM?</p>
      <p style="margin:0;line-height:1.6"><b>A:</b> ${ANSWER}</p>
    </div>
  </div>
</section>`;
}

function softwareSchema(url) {
  const obj = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ConversionCRM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url,
    description:
      "Free trial conversion software for SaaS: 6-layer engagement scoring, automatic lifecycle stages, and 8 behavior-triggered emails that turn sign-ups into paid users.",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "699",
      offerCount: "5",
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

let changed = 0;
for (const rel of targets) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, "utf8");
  const url = SITE + "/" + rel.replace(/\.html$/, "");

  if (html.includes("Q: What is ConversionCRM?")) {
    console.log(`skip (already has Q/A): ${rel}`);
    continue;
  }
  if (!html.includes("</header>") || !html.includes("</head>")) {
    console.log(`SKIP (missing anchor): ${rel}`);
    continue;
  }

  // Visible direct-answer block right after the hero.
  html = html.replace("</header>", "</header>\n" + answerBlock());
  // SoftwareApplication schema right before </head>.
  html = html.replace("</head>", softwareSchema(url) + "\n</head>");

  fs.writeFileSync(file, html, "utf8");
  changed++;
  console.log(`updated: ${rel}`);
}
console.log(`\nDone. ${changed} file(s) updated.`);
