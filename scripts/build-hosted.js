/* Builds dist/: what Cloudflare Pages serves at inkognito.co.il.

     node scripts/build-hosted.js [outDir]
     npx wrangler pages deploy dist      (from the repository root, so functions/ goes too)

   - the root: the landing site, sign-in and legal pages (site/), with the sign-in client;
   - /app/: exactly the files the tool loads (scripts/build-site.js SITE_FILES), its page with
     the hosted injection (scripts/hosted.js), behind the gate (functions/_middleware.js, which
     also sets their caching: private);
   - the model's weights re-split under Cloudflare's 25 MiB file cap, and this build's copy of
     the engine told the new part names (partNofM: a different split never reuses a cached
     name). Joined, they are the same bytes: the page checks the SHA-256. The repository's model
     files and the public tool are untouched;
   - _headers: no framing, no sniffing, the app kept out of search engines, and the pages marked
     no-transform so that Cloudflare adds none of its own scripts to them;
   - _routes.json: the gate runs in front of every request except the site's own public files,
     each named exactly (no pattern an encoded path could slip into). Exact names also keep
     the landing page off the daily Functions quota.
   tests/hosted_t.js checks the result. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { SITE_FILES } = require("./build-site.js");
const { hostedApp, demoApp, hostedManifest, hostedWorker, resourcesScript, LIBS, ORT_FILES, ortFrom, ortPin, ORT_DIR } = require("./hosted.js");

const ROOT = path.resolve(__dirname, "..");
const LIMIT = 25 * 1024 * 1024; // Cloudflare Pages: no file over 25 MiB
const PARTS = 8;
const MARK = ".inkognito-build";

/* The real domain was attached before launch (4.10), so that the sign-in emails' links are on the
   domain that sends them (Gmail put the first ones in spam: a day-old domain, links to pages.dev).
   Until the owner launches, it stays out of search engines too, under every name the site answers
   at: the noindex sits in the rule for every address, since a rule for inkognito.co.il alone missed
   "inkognito.co.il." with its final dot (review 5.10). In that rule, not in a second "/*" one:
   Cloudflare keeps one rule per pattern, and a second "/*" took the security headers off every
   page (seen live, 5.10; tests/hosted_t.js now refuses a repeated pattern). Where it meets another
   noindex rule, Cloudflare joins the two into "noindex, noindex", which means the same. At launch:
   true, build, deploy (docs/INKOGNITO-LAUNCH.md, step 7). */
const LAUNCHED = false;
const HEADERS_NOW = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${LAUNCHED ? "" : "  X-Robots-Tag: noindex\n"}
/app/*
  X-Robots-Tag: noindex

/demo/*
  X-Robots-Tag: noindex

https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
`;
const ROUTE_LIMIT = 100; // Cloudflare Pages: at most 100 include and exclude rules together
const HEADER_LIMIT = 100; // Cloudflare Pages: at most 100 rules in _headers

// an existing folder is replaced only if this script made it (the same rule as build-site.js)
function safeToReplace(out) {
  if (!fs.existsSync(out)) return true;
  if (!fs.statSync(out).isDirectory()) return false;
  const names = fs.readdirSync(out);
  return !names.length || names.includes(MARK);
}

function copyTree(from, to) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyTree(a, b); } else fs.copyFileSync(a, b);
  }
}

/* Clean links (the gap review, finding 10, 6.10). Cloudflare serves each page at its name without .html
   and sends the .html address there, so every link between the site's pages cost a redirect, and a search
   engine met two addresses for each page. The root's pages and scripts name the clean address instead:
   "privacy.html#x" is "privacy#x", "index.html" is "./" ("/" when it was "/index.html"). The sources keep
   the .html names, which a plain file server (e2e/server.js, GitHub Pages) also serves. */
function cleanLinks(out) {
  const names = fs.readdirSync(out).filter((f) => /^[a-z][a-z0-9-]*\.html$/.test(f) && f !== "404.html").map((f) => f.slice(0, -".html".length));
  const rx = new RegExp("([\"'/])(" + names.join("|") + ")\\.html(?=[\"'#?])", "g");
  for (const f of fs.readdirSync(out).filter((x) => /\.(html|js)$/.test(x))) {
    const file = path.join(out, f), s = fs.readFileSync(file, "utf8");
    const t = s.replace(rx, (m, a, n) => n !== "index" ? a + n : a === "/" ? "/" : a + "./");
    if (t !== s) fs.writeFileSync(file, t);
  }
}

function build(out) {
  if (path.basename(out).startsWith("-")) throw new Error("not a folder name: " + path.basename(out));
  if (!safeToReplace(out)) throw new Error("refusing to delete " + out + ": it is not a folder this script built");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, MARK), "");

  const site = path.join(ROOT, "site");
  if (!fs.existsSync(path.join(site, "vendor"))) throw new Error("site/vendor/ is missing: run npm install (scripts/vendor.js)");
  copyTree(site, out);
  cleanLinks(out);

  const model = SITE_FILES.filter((f) => /\.part\d+$/.test(f));
  for (const f of SITE_FILES.filter((x) => !model.includes(x))) {
    const to = path.join(out, "app", f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), to);
  }
  fs.writeFileSync(path.join(out, "app", "index.html"), hostedApp(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")));
  fs.writeFileSync(path.join(out, "app", "manifest.webmanifest"), hostedManifest(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8")));
  fs.writeFileSync(path.join(out, "app", "sw.js"), hostedWorker(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")));

  // the weights: joined from the repository's parts, checked, split again under the cap
  const eng = fs.readFileSync(path.join(ROOT, "redact-engine.js"), "utf8");
  const spec = eng.match(/weights:\{file:"([^"]+)",bytes:(\d+),\s*sha256:"([0-9a-f]{64})",\s*parts:\[([^\]]*)\]/);
  if (!spec) throw new Error("build-hosted: redact-engine.js no longer has NER_SPEC.weights in the expected form");
  const dirOf = path.posix.dirname(model[0]); // models/<id>/onnx
  const whole = Buffer.concat(model.map((f) => fs.readFileSync(path.join(ROOT, f))));
  if (whole.length !== Number(spec[2]) || crypto.createHash("sha256").update(whole).digest("hex") !== spec[3])
    throw new Error("build-hosted: the repository's model parts do not match NER_SPEC");
  const size = Math.ceil(whole.length / PARTS), names = [];
  if (size > LIMIT) throw new Error("build-hosted: " + PARTS + " parts would still exceed 25 MiB");
  fs.mkdirSync(path.join(out, "app", dirOf), { recursive: true });
  for (let i = 0; i < PARTS; i++) {
    const name = spec[1] + ".part" + (i + 1) + "of" + PARTS; // onnx/model_quantized.onnx.part1of8
    fs.writeFileSync(path.join(out, "app", path.posix.dirname(dirOf), name), whole.subarray(i * size, Math.min(whole.length, (i + 1) * size)));
    names.push(name);
  }
  const list = "parts:[" + names.map((n) => JSON.stringify(n)).join(",") + "]";
  fs.writeFileSync(path.join(out, "app", "redact-engine.js"), eng.replace(/parts:\[[^\]]*\]/, list));

  // the tool's libraries, served by the site itself (scripts/hosted.js): each the same file the
  // tool pins, or the build stops
  const put = (rel, buf) => { const to = path.join(out, "app", rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, buf); };
  for (const l of LIBS) {
    const buf = fs.readFileSync(path.join(ROOT, l.from)), pin = l.pin();
    if (l.via !== "atlas" && (!pin || "sha384-" + crypto.createHash("sha384").update(buf).digest("base64") !== pin))
      throw new Error("build-hosted: " + l.from + " is not the file the tool pins for " + l.url);
    put(l.to, buf);
  }
  const ortParts = {};
  for (const name of ORT_FILES) {
    const buf = fs.readFileSync(path.join(ROOT, ortFrom(name)));
    if (crypto.createHash("sha256").update(buf).digest("base64") !== ortPin(name)) throw new Error("build-hosted: " + ortFrom(name) + " is not the runtime the engine pins");
    const n = Math.ceil(buf.length / LIMIT), size = Math.ceil(buf.length / n);
    if (n === 1) { put(ORT_DIR() + name + ".wasm", buf); continue; }
    ortParts[name] = n;
    for (let i = 0; i < n; i++) put(ORT_DIR() + name + ".wasm.part" + (i + 1), buf.subarray(i * size, Math.min(buf.length, (i + 1) * size)));
  }
  put("hosted-resources.js", resourcesScript(ortParts));

  /* /demo/: the no-account demo (scripts/hosted.js, demoApp). Public, outside the gate: only what the tool
     needs for the invented sample, never the model, the AI runtime, the PDF reader or the service worker,
     and no sign-in. Its libraries are the same checked copies as /app/'s. */
  const DEMO_SKIP = /^(sw\.js|manifest\.webmanifest|pdf-text\.js|models\/|vendor\/(transformers|ort|pdfjs))/;
  for (const f of SITE_FILES.filter((x) => !model.includes(x) && !DEMO_SKIP.test(x) && x !== "index.html")) {
    const to = path.join(out, "demo", f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), to);
  }
  fs.writeFileSync(path.join(out, "demo", "index.html"), demoApp(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")));
  for (const l of LIBS) {
    const to = path.join(out, "demo", l.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(out, "app", l.to), to);
  }
  // the libraries' addresses without the AI runtime, which the demo never loads
  const demoRes = resourcesScript({}), cut = demoRes.indexOf(',\n "ort"');
  fs.writeFileSync(path.join(out, "demo", "hosted-resources.js"), cut > 0 ? demoRes.slice(0, cut) + "\n});\n" : demoRes);
  // the tool's fonts and their licences came with SITE_FILES above: the page names them itself (v60)

  /* The public files skip the gate by exact name; everything else, /app/ above all, meets it. A
     page also goes by the address Cloudflare serves it at: /login.html redirects to /login, and
     /index.html is /. Without those, every visit to the landing and sign-in pages ran the gate (the
     free plan's daily quota), and with "fail closed" set they would show Cloudflare's error page
     once the quota ran out (4.10). */
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(out).map((f) => "/" + path.relative(out, f).split(path.sep).join("/"))
    .filter((p) => !/^\/app\//i.test(p) && !/(^|\/)\./.test(p) && !["/_headers", "/_routes.json"].includes(p));
  const pretty = files.filter((p) => /^\/[^/]+\.html$/.test(p)).map((p) => p === "/index.html" ? "/" : p.slice(0, -".html".length));
  // and a public folder's page by its folder's address, with and without the slash (/demo/ and /demo,
  // which Cloudflare sends on to /demo/; without it the gate would send it to sign-in)
  const folders = files.filter((p) => /^\/[^/]+\/index\.html$/.test(p)).flatMap((p) => [p.slice(0, -"index.html".length), p.slice(0, -"/index.html".length)]);
  const pub = [...new Set([...files, ...pretty, ...folders])].sort();
  if (pub.length + 1 > ROUTE_LIMIT) throw new Error("build-hosted: " + pub.length + " public files exceed Cloudflare's " + ROUTE_LIMIT + " route rules");
  fs.writeFileSync(path.join(out, "_routes.json"), JSON.stringify({ version: 1, include: ["/*"], exclude: pub }, null, 1));

  /* Every page names its public scripts and styles by a version taken from their content
     (config.js?v=…). Cloudflare's zone setting "Browser Cache TTL" (4 hours by default) lets a
     browser keep a public script for hours, while the pages are checked on every visit: after a
     deploy, a fresh page could run an old script (5.10; the dashboard did not offer "Respect
     Existing Headers"). A new version is a new address. The tool's own files under /app/ keep
     their names: the gate serves them "private, no-cache", which Cloudflare leaves alone, and the
     tool's service worker knows them by name. */
  for (const page of walk(out).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(page, "utf8").replace(/\b(src|href)="([^"?#:]+\.(?:js|css))"/g, (m, attr, ref) => {
      const file = ref.startsWith("/") ? path.join(out, ref) : path.resolve(path.dirname(page), ref);
      if (path.relative(out, file).split(path.sep)[0] === "app") return m;
      if (!fs.existsSync(file)) throw new Error("build-hosted: " + path.relative(out, page) + " names " + ref + ", which the site does not have");
      return attr + '="' + ref + "?v=" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10) + '"';
    });
    fs.writeFileSync(page, html);
  }

  /* Cloudflare adds its own scripts to a page on the way out when the zone has them on: Web
     Analytics' beacon was found on the real domain (4.10), and it breaks "nothing is loaded from
     another site". "no-transform" tells Cloudflare not to touch a page. Only on the pages, at both
     their addresses: it also stops Cloudflare's compression, which matters for the scripts and the
     model, not for these. The gate does the same for the pages it serves (lib/gate.mjs). */
  const pages = files.filter((p) => /^\/[^/]+\.html$/.test(p)).flatMap((p) => [p, p === "/index.html" ? "/" : p.slice(0, -".html".length)]);
  const headers = HEADERS_NOW + "\n" + pages.map((p) => p + "\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n").join("\n");
  const rules = headers.split("\n").filter((l) => l && !/^\s/.test(l)).length;
  if (rules > HEADER_LIMIT) throw new Error("build-hosted: " + rules + " header rules exceed Cloudflare's " + HEADER_LIMIT);
  fs.writeFileSync(path.join(out, "_headers"), headers);
  return out;
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, "dist"));
  build(out);
  console.log("wrote the hosted site to " + out);
}

module.exports = { build, LIMIT, LAUNCHED };
