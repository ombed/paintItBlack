/* Minimal static server for the browser checks. Deliberately dependency-free:
   the whole point of these tests is to catch things only a real browser sees,
   and a server that can rot independently is one more thing to debug. */
const http = require("http");
const fs = require("fs");
const path = require("path");

// SITE_ROOT serves the built site (scripts/build-site.js) instead of the repo,
// so the deploy workflow checks exactly what it is about to publish
const ROOT = path.resolve(process.env.SITE_ROOT || path.join(__dirname, ".."));
const PORT = 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
};

http
  .createServer((req, res) => {
    // a malformed escape must not kill the server: a crashed server reads as a red test run (review L3)
    let url;
    try { url = decodeURIComponent(req.url.split("?")[0]); } catch (_) { res.writeHead(400).end("bad request"); return; }
    const file = path.join(ROOT, url === "/" ? "/index.html" : url);
    // inside ROOT means ROOT plus a separator: a bare prefix test also let a sibling folder through
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      });
      res.end(buf);
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log("serving " + ROOT + " on " + PORT));
