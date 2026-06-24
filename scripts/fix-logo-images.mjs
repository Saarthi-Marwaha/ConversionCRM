// One-off: give the brand logo <img> descriptive alt text + width/height
// (CLS) across every static marketing page. Footer logo is below the fold so
// it also gets loading="lazy". Nav logo stays eager (above the fold).
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/site";

// Footer brand link carries style="font-size:14.5px"; match that to target the
// footer logo specifically (lazy + 22px-height dims).
const FOOTER_FROM = `style="font-size:14.5px"><img src="/assets/logo_CRM-removebg-preview.png" alt="" class="logo-img">`;
const FOOTER_TO = `style="font-size:14.5px"><img src="/assets/logo_CRM-removebg-preview.png" alt="ConversionCRM home" class="logo-img" width="27" height="22" loading="lazy">`;

// Everything else with an empty-alt logo is the above-the-fold nav logo.
const NAV_FROM = `<img src="/assets/logo_CRM-removebg-preview.png" alt="" class="logo-img">`;
const NAV_TO = `<img src="/assets/logo_CRM-removebg-preview.png" alt="ConversionCRM logo" class="logo-img" width="37" height="30">`;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

let stats = { footer: 0, nav: 0, files: 0 };
for (const file of walk(ROOT)) {
  let html = readFileSync(file, "utf8");
  const before = html;
  // Footer first (more specific), then any remaining empty-alt logos = nav.
  if (html.includes(FOOTER_FROM)) {
    html = html.split(FOOTER_FROM).join(FOOTER_TO);
    stats.footer++;
  }
  if (html.includes(NAV_FROM)) {
    const count = html.split(NAV_FROM).length - 1;
    html = html.split(NAV_FROM).join(NAV_TO);
    stats.nav += count;
  }
  if (html !== before) { writeFileSync(file, html); stats.files++; }
}
console.log(JSON.stringify(stats, null, 2));
