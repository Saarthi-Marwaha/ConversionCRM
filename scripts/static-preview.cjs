/* Minimal static file server for previewing the generated marketing/blog
   HTML (with /assets/*) exactly as Vercel serves it from /public. Dev-only. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "public");
const PORT = process.env.PORT ? Number(process.env.PORT) : 8799;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    // Clean-URL convenience: /blog/x -> /site/blog/x.html (mirrors the
    // next.config rewrites, so links in the page resolve while previewing).
    let filePath = path.join(ROOT, urlPath);
    if (urlPath === "/" ) filePath = path.join(ROOT, "site", "landing.html");
    else if (!path.extname(urlPath)) {
      const candidate = path.join(ROOT, "site", urlPath + ".html");
      if (fs.existsSync(candidate)) filePath = candidate;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404: " + urlPath);
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`static-preview serving ${ROOT} at http://localhost:${PORT}`));
