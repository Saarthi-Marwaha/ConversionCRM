// One-off: normalize the comparison nav dropdown, mobile menu, and footer
// Compare column across every static marketing page so HubSpot + Mailchimp
// appear everywhere (8 compare pages, consistent order).
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/site";

// ── Canonical blocks ────────────────────────────────────────────────────────

const DESKTOP = `<a class="drop-item" href="/compare/customerio"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg></span><span><b>vs Customer.io</b><span>Behavior-triggered emails vs journey builders</span></span></a><a class="drop-item" href="/compare/hubspot"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="4"/><path d="M16 16h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2"/><path d="M12 20v-4"/><path d="M12 16h4"/></svg></span><span><b>vs HubSpot</b><span>Trial conversion engine vs full CRM suite</span></span></a><a class="drop-item" href="/compare/intercom"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.5-.7L3 21l1.8-5.5A8.38 8.38 0 1 1 21 11.5Z"/></svg></span><span><b>vs Intercom</b><span>Lifecycle emails vs a support inbox</span></span></a><a class="drop-item" href="/compare/mailchimp"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span><span><b>vs Mailchimp</b><span>Behavior-triggered vs broadcast email</span></span></a><a class="drop-item" href="/compare/appcues"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 7.5 17 2.4-7.1L21 11.5Z"/></svg></span><span><b>vs Appcues</b><span>Lifecycle emails vs in-app product tours</span></span></a><a class="drop-item" href="/compare/pendo"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21v-7M12 21V9M19 21V4"/><path d="M3 21h18"/></svg></span><span><b>vs Pendo</b><span>3-minute setup vs enterprise analytics</span></span></a><a class="drop-item" href="/compare/userpilot"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-2.2 5.2L8 16l2.2-5.2Z"/></svg></span><span><b>vs Userpilot</b><span>Conversion focus vs flow builder</span></span></a><a class="drop-item" href="/compare/userflow"><span class="drop-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="6" r="2.5"/><circle cx="18.5" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7 8 10.5 16M17 8 13.5 16"/></svg></span><span><b>vs Userflow</b><span>Paid conversion vs onboarding guides</span></span></a><a class="drop-all" href="/compare">All comparisons →</a>`;

const MOBILE = `<a class="mm-sub" href="/compare/customerio">vs Customer.io</a>
    <a class="mm-sub" href="/compare/hubspot">vs HubSpot</a>
    <a class="mm-sub" href="/compare/intercom">vs Intercom</a>
    <a class="mm-sub" href="/compare/mailchimp">vs Mailchimp</a>
    <a class="mm-sub" href="/compare/appcues">vs Appcues</a>
    <a class="mm-sub" href="/compare/pendo">vs Pendo</a>
    <a class="mm-sub" href="/compare/userpilot">vs Userpilot</a>
    <a class="mm-sub" href="/compare/userflow">vs Userflow</a>
    <a class="mm-sub" href="/compare"><b>All comparisons →</b></a>`;

const FOOTER = `<b>Compare</b>
      <a href="/compare/customerio">vs Customer.io</a>
      <a href="/compare/hubspot">vs HubSpot</a>
      <a href="/compare/intercom">vs Intercom</a>
      <a href="/compare/mailchimp">vs Mailchimp</a>
      <a href="/compare/appcues">vs Appcues</a>
      <a href="/compare/pendo">vs Pendo</a>
      <a href="/compare/userpilot">vs Userpilot</a>
      <a href="/compare/userflow">vs Userflow</a>
      <a href="/compare">All comparisons</a>`;

// ── Regexes (non-greedy, DOTALL via [\s\S]) ─────────────────────────────────

const RE_DESKTOP = /<a class="drop-item" href="\/compare\/customerio">[\s\S]*?<a class="drop-all" href="\/compare">All comparisons →<\/a>/;
const RE_MOBILE  = /<a class="mm-sub" href="\/compare\/customerio">[\s\S]*?<a class="mm-sub" href="\/compare"><b>All comparisons →<\/b><\/a>/;
const RE_FOOTER  = /<b>Compare<\/b>[\s\S]*?<a href="\/compare">All comparisons<\/a>/;

// ── Walk ────────────────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

let stats = { desktop: 0, mobile: 0, footer: 0, files: 0 };
for (const file of walk(ROOT)) {
  let html = readFileSync(file, "utf8");
  const before = html;
  if (RE_DESKTOP.test(html)) { html = html.replace(RE_DESKTOP, DESKTOP); stats.desktop++; }
  if (RE_MOBILE.test(html))  { html = html.replace(RE_MOBILE, MOBILE);   stats.mobile++; }
  if (RE_FOOTER.test(html))  { html = html.replace(RE_FOOTER, FOOTER);   stats.footer++; }
  if (html !== before) { writeFileSync(file, html); stats.files++; console.log("updated", file); }
}
console.log(JSON.stringify(stats, null, 2));
