/* The hosted build (scripts/build-hosted.js): what Cloudflare Pages serves at inkognito.co.il.
   The landing site sits at the root, the tool under /app/ (behind the gate in functions/), with
   the hosted injection, and the model's weights re-split under Cloudflare's 25 MiB file cap.
   It builds into a temporary folder and checks the result file by file. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { build, LIMIT, LAUNCHED } = require("../scripts/build-hosted.js");
const { SITE_FILES } = require("../scripts/build-site.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const ROOT = path.join(__dirname, "..");
const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), b) : [path.relative(b, path.join(d, e.name)).split(path.sep).join("/")]);

const out = fs.mkdtempSync(path.join(os.tmpdir(), "ink-hosted-"));
try {
  const dist = path.join(out, "dist");
  build(dist);
  const files = walk(dist);
  const read = (f) => fs.readFileSync(path.join(dist, f), "utf8");

  console.log("\n— the site at the root —");
  for (const f of ["index.html", "login.html", "terms.html", "privacy.html", "accessibility.html", "admin.html", "admin.js", "site.css", "config.js", "cloud.js", "login.js"])
    ok(files.includes(f), "the root has " + f);
  const sv = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/@supabase/supabase-js/package.json"), "utf8")).version;
  ok(files.includes(`vendor/supabase-${sv}.js`), "the root has the sign-in client the pages name");
  ok(files.includes("_headers"), "security headers for Cloudflare (_headers)");

  console.log("\n— the tool under /app/ —");
  const model = SITE_FILES.filter((f) => /\.part\d+$/.test(f));
  for (const f of SITE_FILES.filter((f) => !model.includes(f))) ok(files.includes("app/" + f), "app/ has " + f);
  const app = read("app/index.html");
  ok(/<script src="\.\.\/cloud\.js\?v=[0-9a-f]{10}"><\/script>/.test(app) && /connect-src 'self' https:\/\/cwsiranjlxbclmaqtucc\.supabase\.co/.test(app), "app/index.html carries the hosted injection");
  ok(!/<script[^>]*(cloud|config|supabase)/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), "the repository's index.html (the public tool) does not");

  console.log("\n— a place for the account button in the top bar —");
  ok(/onTheme[^\n]*<\/button>\s*<span data-ink-account[^>]*><\/span>\s*<\/header>/.test(app), "beside the day/night button, inside the header");
  ok(!/data-ink-account/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), "not in the public tool");

  console.log("\n— the hosted tool's name —");
  ok((app.match(/<title>אינקוגניטו<\/title>/g) || []).length === 2 && !/השחרת מסמכים<\/(title|span)>/.test(app), "the page's title (twice) and header say אינקוגניטו");
  const man = JSON.parse(read("app/manifest.webmanifest"));
  ok(man.name === "אינקוגניטו" && man.short_name === "אינקוגניטו" && man.start_url === "./", "the install manifest names it, and nothing else in it changed");
  ok(JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8")).name === "השחרת מסמכים", "the public tool keeps its own name");

  console.log("\n— what the hosted tool says about sending —");
  ok(!app.includes("לא נשלח מעצמו") && !app.includes("ב-issue"), "it does not say that nothing is sent by itself, nor suggest a public issue");
  ok(app.includes("הוא נשלח מעצמו בסוף כל מסמך"), "it says the log goes up by itself, for whoever agreed");
  ok(fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes("שום דבר לא נשלח מעצמו"), "the public tool keeps its own words, true there");

  console.log("\n— the model, re-split under the cap —");
  const eng = read("app/redact-engine.js");
  const spec = eng.match(/weights:\{file:"([^"]+)",bytes:(\d+),\s*sha256:"([0-9a-f]{64})",\s*parts:\[([^\]]*)\]/);
  ok(spec, "the engine still states the weights' size, hash and parts");
  const parts = spec ? [...spec[4].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  ok(parts.length >= 8, "the weights come in " + parts.length + " parts");
  const dir = "app/models/dictabert-parse-ner-37f4d6f/";
  ok(parts.every((p) => files.includes(dir + p)), "every part the engine names is shipped");
  ok(parts.every((p) => /\.part\d+of8$/.test(p)), "each part's name carries the split (part1of8): a different split never reuses a cached name");
  const shippedParts = files.filter((f) => f.startsWith(dir + "onnx/") && /\.part\d+(of\d+)?$/.test(f));
  ok(shippedParts.length === parts.length, "and no other part is");
  const joined = Buffer.concat(parts.map((p) => fs.readFileSync(path.join(dist, dir + p))));
  ok(spec && joined.length === Number(spec[2]), "joined, the parts are the stated size");
  ok(spec && crypto.createHash("sha256").update(joined).digest("hex") === spec[3], "joined, they have the stated SHA-256 (the page checks it too)");
  const origEng = fs.readFileSync(path.join(ROOT, "redact-engine.js"), "utf8");
  ok(eng.replace(/parts:\[[^\]]*\]/, "") === origEng.replace(/parts:\[[^\]]*\]/, ""), "nothing else in the engine changed");

  console.log("\n— the hosted tool asks no other site for anything —");
  const H = require("../scripts/hosted.js");
  const csp = (app.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  ok(!/https:\/\/(?!cwsiranjlxbclmaqtucc\.supabase\.co)/.test(csp), "the page's policy names no other site but the project: " + csp.slice(0, 80) + "…");
  ok(!/unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(app), "the page names no CDN and no Google Fonts");
  const res = read("app/hosted-resources.js");
  const map = JSON.parse((res.match(/Object\.assign\(window\.__resources \|\| \{\}, (\{[\s\S]*\})\);/) || [, "{}"])[1]);
  for (const l of H.LIBS) {
    const at = "app/" + l.to;
    ok(files.includes(at), "the site serves its own " + path.basename(l.to));
    if (l.via === "resources") ok(map[l.url] === "./" + l.to, "the tool is told to load " + path.basename(l.to) + " from the site");
    if (l.via === "page") ok(app.includes('"./' + l.to + '","sha384-'), "the page loads " + path.basename(l.to) + " from the site, its integrity check kept");
    if (l.via === "atlas") ok(map.atlas === "./" + l.to, "the map's data comes from the site");
    if (l.pin()) ok("sha384-" + crypto.createHash("sha384").update(fs.readFileSync(path.join(dist, at))).digest("base64") === l.pin(), path.basename(l.to) + " is byte for byte the file the tool pins");
  }
  ok(map.ort && map.ort.base === "./" + H.ORT_DIR(), "the runtime's WebAssembly comes from the site (" + (map.ort && map.ort.base) + ")");
  for (const name of H.ORT_FILES) {
    const n = (map.ort.parts || {})[name] || 1;
    const ps = n === 1 ? [H.ORT_DIR() + name + ".wasm"] : Array.from({ length: n }, (_, i) => H.ORT_DIR() + name + ".wasm.part" + (i + 1));
    ok(ps.every((p) => files.includes("app/" + p)), name + ": every file the engine will ask for is there (" + n + ")");
    const joined = Buffer.concat(ps.filter((p) => files.includes("app/" + p)).map((p) => fs.readFileSync(path.join(dist, "app", p))));
    ok(crypto.createHash("sha256").update(joined).digest("base64") === H.ortPin(name), name + ": joined, it is the runtime the engine pins");
  }
  ok((map.ort.parts || {})["ort-wasm-simd-threaded.asyncify"] >= 2, "the 25.7 MiB runtime is split under the cap");
  const fonts = read("app/fonts/app-fonts.css");
  const urls = [...fonts.matchAll(/url\(\.\/([^)]+)\)/g)].map((m) => m[1]);
  ok(urls.length && urls.every((u) => files.includes("app/fonts/" + u)), "every font file the stylesheet names is there (" + urls.length + ")");
  for (const [fam, w] of [["Rubik", 300], ["Rubik", 400], ["Rubik", 500], ["Rubik", 600], ["Noto Serif Hebrew", 400], ["Noto Serif Hebrew", 500]])
    ok(new RegExp("font-family: '" + fam + "';[^}]*font-weight: " + w + ";[^}]*hebrew", "s").test(fonts), "the Hebrew face of " + fam + " " + w + " is served");
  ok(app.includes('<link href="./fonts/app-fonts.css" rel="stylesheet">'), "the page takes its fonts from the site");
  for (const fam of ["rubik", "noto-serif-hebrew"]) ok(/SIL Open Font License/.test(read("app/fonts/" + fam + "-LICENSE.txt")), "the Open Font License travels with " + fam);

  console.log("\n— Cloudflare's limits, and nothing extra —");
  const big = files.filter((f) => fs.statSync(path.join(dist, f)).size > LIMIT);
  ok(!big.length, "every file is at most 25 MiB" + (big.length ? ": " + big.join(", ") : ""));
  ok(files.length < 20000, "fewer than 20,000 files (" + files.length + ")");
  const stray = files.filter((f) => /^(tests|e2e|supabase|bench|docs|scripts|node_modules|functions|lib)\//.test(f) || /\.(md|sql)$/.test(f) && !/NOTICE\.md$/.test(f));
  ok(!stray.length, "no tests, migrations, scripts or notes are published" + (stray.length ? ": " + stray.slice(0, 5).join(", ") : ""));
  const h = read("_headers");
  ok(/\/app\/\*[\s\S]*X-Robots-Tag: noindex/.test(h) && /X-Frame-Options: DENY/.test(h) && /X-Content-Type-Options: nosniff/.test(h), "_headers: no framing, no sniffing, the app not indexed");
  ok(/https:\/\/:project\.pages\.dev\/\*\s*\n\s*X-Robots-Tag: noindex/.test(h) && /https:\/\/:version\.:project\.pages\.dev\/\*\s*\n\s*X-Robots-Tag: noindex/.test(h), "the pages.dev copies (production and previews) are kept out of search engines");
  ok(files.includes("sitemap.xml") && /https:\/\/inkognito\.co\.il\/privacy/.test(read("sitemap.xml")) && /Sitemap: https:\/\/inkognito\.co\.il\/sitemap\.xml/.test(read("robots.txt")), "a sitemap of the public pages, named in robots.txt");
  /* Caching is the gate's, except one thing on the public pages: no-transform, so that Cloudflare adds
     none of its own scripts to them (its Web Analytics beacon was found on the real domain, 4.10).
     Each page gets it at both its addresses, by an exact rule that sets nothing else, and no other
     rule sets Cache-Control: two rules on one path would join their values. */
  const rules = h.split(/\n(?=\S)/).map((b) => { const [p, ...l] = b.trim().split("\n"); return { p: p.trim(), cc: l.filter((x) => /^\s*Cache-Control:/i.test(x)) }; });
  const withCc = rules.filter((r) => r.cc.length);
  ok(withCc.length > 0 && withCc.every((r) => !/[*:]/.test(r.p) && r.cc.length === 1 && /^\s*Cache-Control: public, max-age=0, must-revalidate, no-transform$/.test(r.cc[0])), "only exact page rules set Cache-Control, each once, with no-transform");
  const pagesServed = files.filter((f) => /^[^/]+\.html$/.test(f)).flatMap((f) => ["/" + f, f === "index.html" ? "/" : "/" + f.slice(0, -5)]);
  ok(pagesServed.every((p) => withCc.some((r) => r.p === p)) && withCc.every((r) => pagesServed.includes(r.p)), "every page has it, at both addresses, and nothing else does (" + withCc.length + " rules)");
  ok(new Set(withCc.map((r) => r.p)).size === withCc.length, "no page address has two such rules");
  /* The real domain is attached before launch (4.10); until then it is kept out of search engines,
     under every name the site answers at: a rule for the host alone missed "inkognito.co.il." with
     its final dot (review 5.10). */
  const blocks = h.split(/\n(?=\S)/).map((b) => { const [p, ...l] = b.trim().split("\n"); return { p: p.trim(), lines: l.map((x) => x.trim()).filter(Boolean) }; });
  const every = blocks.filter((b) => b.p === "/*");
  const early = every.length === 1 && every[0].lines.includes("X-Robots-Tag: noindex");
  ok(LAUNCHED ? !early : early, LAUNCHED ? "launched: inkognito.co.il is open to search engines" : "before launch: every address is kept out of search engines");
  /* Cloudflare keeps one rule per pattern: a second "/*" rule for the noindex took the security
     headers off every page (seen live, 5.10). So no pattern twice, and the rule for every address
     still carries them. */
  const patterns = blocks.map((b) => b.p);
  ok(new Set(patterns).size === patterns.length, "no pattern has two rules in _headers (" + patterns.length + " rules)");
  ok(every.length === 1 && ["X-Content-Type-Options: nosniff", "X-Frame-Options: DENY", "Referrer-Policy: strict-origin-when-cross-origin", "Permissions-Policy: camera=(), microphone=(), geolocation=()"].every((x) => every[0].lines.includes(x)), "the rule for every address carries the security headers");
  // a crawler must be allowed to fetch a page to read its noindex: robots.txt blocks none of them (5.10)
  const disallow = read("robots.txt").split("\n").map((l) => (l.match(/^Disallow:\s*(\S+)/i) || [])[1]).filter(Boolean);
  const noindexPages = files.filter((f) => /^[^/]+\.html$/.test(f) && /<meta name="robots" content="[^"]*noindex/.test(read(f)));
  const blocked = noindexPages.flatMap((f) => ["/" + f, "/" + f.slice(0, -5)]).filter((p) => disallow.some((d) => p.startsWith(d)));
  ok(noindexPages.length >= 3 && !blocked.length, "robots.txt lets crawlers read the noindex of " + noindexPages.length + " pages" + (blocked.length ? "; it blocks " + blocked.join(", ") : ""));

  console.log("\n— a page always gets the scripts it was built with —");
  /* Cloudflare's zone setting Browser Cache TTL (4 hours by default) lets a browser keep a public
     script for hours, while the pages are checked on every visit: after a deploy, a fresh page could
     run an old script (5.10). So every page names its public scripts and styles by a version taken
     from their content. The tool's own files under /app/ are the gate's ("private, no-cache", which
     Cloudflare leaves alone) and keep their names: its service worker knows them by name. */
  const hash10 = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dist, f))).digest("hex").slice(0, 10);
  const refs = files.filter((f) => f.endsWith(".html")).flatMap((f) => [...read(f).matchAll(/\b(?:src|href)="([^"#:]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map((m) => ({ page: f, ref: m[1] })));
  const target = ({ page, ref }) => { const p = ref.split("?")[0]; return path.posix.normalize(p.startsWith("/") ? p.slice(1) : path.posix.join(path.posix.dirname(page), p)); };
  const pubRefs = refs.filter((r) => !target(r).startsWith("app/"));
  ok(pubRefs.length >= 20, "the pages name " + pubRefs.length + " public scripts and styles");
  const unversioned = pubRefs.filter((r) => !files.includes(target(r)) || r.ref.split("?")[1] !== "v=" + hash10(target(r)));
  ok(!unversioned.length, "each by the version of its content" + (unversioned.length ? ": " + unversioned.slice(0, 4).map((r) => r.page + " → " + r.ref).join(", ") : ""));
  ok(pubRefs.some((r) => r.page === "app/index.html" && /^\.\.\/config\.js\?v=/.test(r.ref)), "the tool's page too, for the scripts it takes from the site");
  ok(refs.filter((r) => target(r).startsWith("app/")).every((r) => !r.ref.includes("?")), "the tool's own files keep their names");

  console.log("\n— the gate runs in front of everything but the public files —");
  const routes = JSON.parse(read("_routes.json"));
  ok(routes.version === 1 && JSON.stringify(routes.include) === '["/*"]', "_routes.json sends every request to the gate");
  ok(routes.exclude.length > 0 && routes.exclude.length + routes.include.length <= 100, "within Cloudflare's 100 route rules (" + (routes.exclude.length + 1) + ")");
  ok(routes.exclude.every((p) => !/[*:]/.test(p)), "the public files are named exactly, no patterns");
  // a page is also served at its address without .html (/login.html redirects to /login, /index.html is /)
  const served = (p) => files.includes(p.slice(1)) || files.includes(p === "/" ? "index.html" : p.slice(1) + ".html");
  ok(routes.exclude.every(served), "each is a file the site has, or the address a page is served at");
  ok(!routes.exclude.some((p) => /^\/app(\/|$)/i.test(p) || /(^|\/)\./.test(p)), "none is under /app/, and no dot file");
  for (const p of ["/index.html", "/login.html", "/privacy.html", "/site.css", "/config.js", "/login.js"]) ok(routes.exclude.includes(p), p + " skips the gate");
  // without these, every visit to the landing and sign-in pages ran the gate, and with "fail closed"
  // an exhausted daily quota would have shut them too (4.10)
  for (const p of ["/", "/login", "/privacy", "/terms", "/accessibility"]) ok(routes.exclude.includes(p), p + " (the address Cloudflare serves the page at) skips the gate");

  console.log("\n— it only replaces a folder it made —");
  const other = path.join(out, "mine"); fs.mkdirSync(other); fs.writeFileSync(path.join(other, "keep.txt"), "x");
  let refused = false; try { build(other); } catch (_) { refused = true; }
  ok(refused && fs.existsSync(path.join(other, "keep.txt")), "a folder with other files is refused and left alone");
  build(dist);
  ok(walk(dist).length === files.length, "rebuilding its own folder works");
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
