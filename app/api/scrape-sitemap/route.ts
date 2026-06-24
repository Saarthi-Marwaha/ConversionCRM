import { NextRequest, NextResponse } from 'next/server';

const MAX_PAGES = 300;
const CONCURRENCY = 6;
const PAGE_TIMEOUT_MS = 12000;
const BATCH_DELAY_MS = 150;

interface PageData {
  url: string;
  title: string;
  description: string;
  h1: string;
  h2s: string[];
  canonical: string;
  lastmod: string;
  statusCode: number;
  depth: number;
  imageCount: number;
  wordCount: number;
}

// ── HTML extraction helpers (regex-based, no cheerio needed) ──────────────────

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
}

function extractMeta(html: string, name: string): string {
  const pats = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']{0,500})["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']{0,500})["'][^>]+(?:name|property)=["']${name}["']`, 'i'),
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
}

function extractHeadings(html: string, tag: string, limit = 8): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m;
  while ((m = regex.exec(html)) !== null && results.length < limit) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text) results.push(text.slice(0, 150));
  }
  return results;
}

function extractCanonical(html: string, base: string): string {
  const pats = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (m) {
      try { return new URL(m[1], base).href; } catch {}
    }
  }
  return base;
}

function isNoIndex(html: string): boolean {
  return /<meta[^>]+(?:name=["']robots["'][^>]+content=["'][^"']*noindex|content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["'])/i.test(html);
}

function extractLinks(html: string, base: string): string[] {
  const regex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    try {
      const raw = m[1].trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
      const url = new URL(raw, base);
      url.hash = '';
      // Remove common tracking/session params
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','fbclid','gclid','_ga'].forEach(p => url.searchParams.delete(p));
      links.push(url.href);
    } catch {}
  }
  return links;
}

function countWords(html: string): number {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').filter(w => w.length > 2).length : 0;
}

function shouldSkipPath(pathname: string): boolean {
  return /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|json|xml|pdf|zip|mp4|mp3|woff2?|ttf|eot|otf|map|gz)(\?|$)/i.test(pathname) ||
    /^\/(wp-json|wp-admin|wp-login|wp-cron|xmlrpc|feed|cgi-bin|_next\/static|_next\/image|api\/|admin\/|dashboard\/login|dashboard\/signup)/i.test(pathname);
}

function getPriority(pathname: string): number {
  const parts = pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  if (parts.length === 0) return 1.0;
  if (parts.length === 1) return 0.8;
  if (parts.length === 2) return 0.7;
  return 0.6;
}

// ── Fetcher with timeout ──────────────────────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<{html: string; status: number; lastmod: string | null; finalUrl: string}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'ConversionCRM-SitemapBot/1.0 (+https://www.conversioncrm.co/tools/sitemap-builder)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const html = await res.text();
    const lastmod = res.headers.get('last-modified');
    return { html, status: res.status, lastmod, finalUrl: res.url };
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Main crawl ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { url?: string; maxPages?: number } = {};
  try { body = await req.json(); } catch {}

  const rawUrl = (body.url || '').trim();
  if (!rawUrl) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const maxPages = Math.min(body.maxPages || 200, MAX_PAGES);
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl.href, depth: 0 }];
  const pages: PageData[] = [];
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  while (queue.length > 0 && pages.length < maxPages) {
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.allSettled(
      batch.map(async ({ url, depth }) => {
        if (visited.has(url)) return;
        visited.add(url);

        try {
          const { html, status, lastmod, finalUrl } = await fetchWithTimeout(url);

          // Mark redirect destination visited
          if (finalUrl !== url) visited.add(finalUrl);

          if (status < 200 || status >= 400) {
            if (status !== 301 && status !== 302) errors.push(`${url} → ${status}`);
            return;
          }

          // Only process HTML
          if (!/<html[\s>]/i.test(html) && !html.includes('<!DOCTYPE')) return;

          // Skip noindex pages
          if (isNoIndex(html)) return;

          const canonical = extractCanonical(html, finalUrl);
          // If canonical points to a different domain, skip this page
          try {
            const cu = new URL(canonical);
            if (cu.hostname !== baseUrl.hostname) return;
          } catch {}

          const title = extractTitle(html) || extractMeta(html, 'og:title') || '';
          const description = extractMeta(html, 'description') || extractMeta(html, 'og:description') || '';
          const h1 = extractH1(html);
          const h2s = extractHeadings(html, 'h2', 6);
          const imageCount = (html.match(/<img[^>]+>/gi) || []).length;
          const wordCount = countWords(html);

          let lastmodDate = today;
          if (lastmod) {
            try { lastmodDate = new Date(lastmod).toISOString().slice(0, 10); } catch {}
          } else {
            // Try og:updated_time or article:modified_time
            const ogDate = extractMeta(html, 'article:modified_time') || extractMeta(html, 'og:updated_time');
            if (ogDate) {
              try { lastmodDate = new Date(ogDate).toISOString().slice(0, 10); } catch {}
            }
          }

          pages.push({ url: canonical, title, description, h1, h2s, canonical, lastmod: lastmodDate, statusCode: status, depth, imageCount, wordCount });

          // Enqueue discovered links
          if (depth < 8 && pages.length + queue.length < maxPages * 3) {
            const links = extractLinks(html, finalUrl);
            const seen = new Set<string>();
            for (const link of links) {
              if (seen.has(link)) continue;
              seen.add(link);
              try {
                const lu = new URL(link);
                if (lu.hostname !== baseUrl.hostname) continue;
                if (shouldSkipPath(lu.pathname)) continue;
                if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
              } catch {}
            }
          }
        } catch (e: any) {
          const msg = e?.message || 'error';
          errors.push(`${url.slice(0, 80)} → ${msg.slice(0, 60)}`);
        }
      })
    );

    if (queue.length > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  // Deduplicate by canonical URL
  const seen = new Set<string>();
  const unique = pages.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  // Sort: depth first, then alphabetical
  unique.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.url.localeCompare(b.url);
  });

  // Build XML sitemap
  const xmlLines = unique.map(p => {
    const u = new URL(p.url);
    const priority = getPriority(u.pathname);
    const cf = p.depth === 0 ? 'weekly' : p.depth === 1 ? 'monthly' : 'monthly';
    return [
      '  <url>',
      `    <loc>${p.url.replace(/&/g, '&amp;')}</loc>`,
      `    <lastmod>${p.lastmod}</lastmod>`,
      `    <changefreq>${cf}</changefreq>`,
      `    <priority>${priority.toFixed(1)}</priority>`,
      '  </url>',
    ].join('\n');
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...xmlLines,
    '</urlset>',
  ].join('\n');

  return NextResponse.json({
    pages: unique,
    xml,
    stats: { total: unique.length, crawled: visited.size, errors: errors.length, maxPages },
    errors: errors.slice(0, 20),
  });
}
