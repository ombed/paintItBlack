/* The hosted build (scripts/build-hosted.js): what Cloudflare Pages serves at inkognito.co.il.
   The landing site sits at the root, the tool under /app/ (behind the gate in functions/), with
   the hosted injection, and the model's weights re-split under Cloudflare's 25 MiB file cap.
   It builds into a temporary folder and checks the result file by file. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { build, LIMIT } = require("../scripts/build-hosted.js");
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
  ok(/<script src="\.\.\/cloud\.js"><\/script>/.test(app) && /connect-src 'self' https:\/\/cwsiranjlxbclmaqtucc\.supabase\.co/.test(app), "app/index.html carries the hosted injection");
  ok(!/<script[^>]*(cloud|config|supabase)/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), "the repository's index.html (the public tool) does not");

  console.log("\n— a place for the account button in the top bar —");
  ok(/onTheme[^\n]*<\/button>\s*<span data-ink-account[^>]*><\/span>\s*<\/header>/.test(app), "beside the day/night button, inside the header");
  ok(!/data-ink-account/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), "not in the public tool");

  console.log("\n— the hosted tool's name —");
  ok((app.match(/<title>אינקוגניטו<\/title>/g) || []).length === 2 && !/השחרת מסמכים<\/(title|span)>/.test(app), "the page's title (twice) and header say אינקוגניטו");
  const man = JSON.parse(read("app/manifest.webmanifest"));
  ok(man.name === "אינקוגניטו" && man.short_name === "אינקוגניטו" && man.start_url === "./", "the install manifest names it, and nothing else in it changed");
  ok(JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8")).name === "השחרת מסמכים", "the public tool keeps its own name");

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
  ok(!/Cache-Control/i.test(h), "_headers sets no caching (the gate does: two rules on one path would join their values)");

  console.log("\n— the gate runs in front of everything but the public files —");
  const routes = JSON.parse(read("_routes.json"));
  ok(routes.version === 1 && JSON.stringify(routes.include) === '["/*"]', "_routes.json sends every request to the gate");
  ok(routes.exclude.length > 0 && routes.exclude.length + routes.include.length <= 100, "within Cloudflare's 100 route rules (" + (routes.exclude.length + 1) + ")");
  ok(routes.exclude.every((p) => !/[*:]/.test(p)), "the public files are named exactly, no patterns");
  ok(routes.exclude.every((p) => files.includes(p.slice(1))), "each is a file the site has");
  ok(!routes.exclude.some((p) => /^\/app(\/|$)/i.test(p) || /(^|\/)\./.test(p)), "none is under /app/, and no dot file");
  for (const p of ["/index.html", "/login.html", "/privacy.html", "/site.css", "/config.js", "/login.js"]) ok(routes.exclude.includes(p), p + " skips the gate");

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
