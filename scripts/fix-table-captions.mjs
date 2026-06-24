// One-off: add a visually-hidden <caption> to every <table> that lacks one,
// for WCAG 2.1 + the Sitechecker "table has no caption" audit. Caption text is
// derived from each page's <title> so it's unique and descriptive, and the
// inline style keeps it out of the visual layout.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/site";
const HIDE =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

let files = 0,
  tables = 0;
for (const file of walk(ROOT)) {
  let html = readFileSync(file, "utf8");
  if (!html.includes("<table>") || html.includes("<caption")) continue;

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  let base = (titleMatch ? titleMatch[1] : "ConversionCRM")
    .replace(/&amp;/g, "&")
    .replace(/\s*[—|].*$/, "") // drop the " — …" / " | …" suffix
    .trim();
  if (!base) base = "ConversionCRM";

  let i = 0;
  html = html.replace(/<table>/g, () => {
    i++;
    const label = i === 1 ? `${base} comparison table` : `${base} comparison table ${i}`;
    tables++;
    return `<table><caption style="${HIDE}">${label}</caption>`;
  });

  writeFileSync(file, html);
  files++;
}
console.log(JSON.stringify({ files, tables }, null, 2));
