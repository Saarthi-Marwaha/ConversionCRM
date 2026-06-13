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
      ],
    };
  },
};

export default nextConfig;
