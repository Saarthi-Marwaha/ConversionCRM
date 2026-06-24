/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint plugin set is incomplete in this project; linting is run separately
  // and shouldn't block production builds / deploys.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["@react-email/components", "react-email"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    // Content-Security-Policy is intentionally permissive on inline scripts:
    // Next.js hydration, the JSON-LD blocks, and Razorpay checkout all need
    // inline execution. The directives still close the common XSS/clickjacking
    // holes (frame-ancestors, base-uri, object-src none) the audit flagged.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co https://*.razorpay.com",
      "frame-src 'self' https://*.razorpay.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.razorpay.com",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // /legal has no index page (only /legal/:slug exists). Send the bare
      // path to the privacy policy with a 301 so a discovered /legal URL
      // resolves cleanly instead of 404-ing ("Not found" in Search Console).
      { source: "/legal", destination: "/legal/privacy", permanent: true },

      // Old /vs-*.html URLs (GSC 404s) — 301 to current compare pages
      { source: "/vs-hubspot.html",   destination: "/compare/hubspot",  permanent: true },
      { source: "/vs-intercom.html",  destination: "/compare/intercom", permanent: true },
      { source: "/vs-mailchimp.html", destination: "/compare/mailchimp",permanent: true },
      { source: "/vs-mixpanel.html",  destination: "/compare",          permanent: true },

      // Bare section index pages with a .html suffix (e.g. /compare.html).
      // These have no :slug, so the per-slug rules below never match them.
      { source: "/compare.html",   destination: "/compare",   permanent: true },
      { source: "/solutions.html", destination: "/solutions", permanent: true },
      { source: "/blog.html",      destination: "/blog",      permanent: true },
      { source: "/resources.html", destination: "/resources", permanent: true },
      { source: "/index.html",     destination: "/",          permanent: true },

      // .html-suffix variants of clean URLs (GSC "Crawled - not indexed")
      // Any stale link to /compare/customerio.html etc. 301s to the clean URL.
      { source: "/compare/:slug.html",         destination: "/compare/:slug",         permanent: true },
      { source: "/solutions/:slug.html",       destination: "/solutions/:slug",       permanent: true },
      { source: "/blog/:slug.html",            destination: "/blog/:slug",            permanent: true },
      { source: "/legal/:slug.html",           destination: "/legal/:slug",           permanent: true },
      { source: "/resources/:type/:slug.html", destination: "/resources/:type/:slug", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Serve the tracking widget at a clean /widget.js?api_key=xyz URL
        { source: "/widget.js", destination: "/api/widget" },

        // ── Static marketing site (merged from lpf, in /public/site) ──
        // Files live under /public/site/* so the clean URLs (/blog, etc.)
        // never collide with a real public directory (which would let the
        // static handler claim the path before these rewrites apply).
        { source: "/blog", destination: "/site/blog/list.html" },
        { source: "/blog/:slug", destination: "/site/blog/:slug.html" },
        { source: "/compare", destination: "/site/compare/list.html" },
        { source: "/compare/:slug", destination: "/site/compare/:slug.html" },
        { source: "/solutions", destination: "/site/solutions/list.html" },
        { source: "/solutions/:slug", destination: "/site/solutions/:slug.html" },
        { source: "/legal/:slug", destination: "/site/legal/:slug.html" },

        // ── Resources section ──
        { source: "/resources", destination: "/site/resources/list.html" },
        { source: "/resources/case-studies", destination: "/site/resources/case-studies/list.html" },
        { source: "/resources/:type/:slug", destination: "/site/resources/:type/:slug.html" },
        { source: "/contribute", destination: "/site/contribute.html" },

        // ── Product / company pages ──
        { source: "/features", destination: "/site/features.html" },
        { source: "/integrations", destination: "/site/integrations.html" },
        { source: "/security", destination: "/site/security.html" },
        { source: "/contact", destination: "/site/contact.html" },
        { source: "/changelog", destination: "/site/changelog.html" },
        { source: "/about", destination: "/site/about.html" },
        { source: "/glossary", destination: "/site/glossary.html" },

        // ── Free tools ──
        { source: "/tools", destination: "/site/tools/list.html" },
        { source: "/tools/sitemap-builder", destination: "/site/tools/sitemap-builder.html" },
      ],
    };
  },
};

export default nextConfig;
