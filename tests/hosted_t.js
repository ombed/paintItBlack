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

  console.log("\n— the model, re-split under the cap —");
  const eng = read("app/redact-engine.js");
  const spec = eng.match(/weights:\{file:"([^"]+)",bytes:(\d+),\s*sha256:"([0-9a-f]{64})",\s*parts:\[([^\]]*)\]/);
  ok(spec, "the engine still states the weights' size, hash and parts");
  const parts = spec ? [...spec[4].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  ok(parts.length >= 8, "the weights come in " + parts.length + " parts");
  const dir = "app/models/dictabert-parse-ner-37f4d6f/";
  ok(parts.every((p) => files.includes(dir + p)), "every part the engine names is shipped");
  const shippedParts = files.filter((f) => f.startsWith(dir + "onnx/") && /\.part\d+$/.test(f));
  ok(shippedParts.length === parts.length, "and no other part is");
  const joined = Buffer.concat(parts.map((p) => fs.readFileSync(path.join(dist, dir + p))));
  ok(spec && joined.length === Number(spec[2]), "joined, the parts are the stated size");
  ok(spec && crypto.createHash("sha256").update(joined).digest("hex") === spec[3], "joined, they have the stated SHA-256 (the page checks it too)");
  const origEng = fs.readFileSync(path.join(ROOT, "redact-engine.js"), "utf8");
  ok(eng.replace(/parts:\[[^\]]*\]/, "") === origEng.replace(/parts:\[[^\]]*\]/, ""), "nothing else in the engine changed");

  console.log("\n— Cloudflare's limits, and nothing extra —");
  const big = files.filter((f) => fs.statSync(path.join(dist, f)).size > LIMIT);
  ok(!big.length, "every file is at most 25 MiB" + (big.length ? ": " + big.join(", ") : ""));
  ok(files.length < 20000, "fewer than 20,000 files (" + files.length + ")");
  const stray = files.filter((f) => /^(tests|e2e|supabase|bench|docs|scripts|node_modules|functions|lib)\//.test(f) || /\.(md|sql)$/.test(f) && !/NOTICE\.md$/.test(f));
  ok(!stray.length, "no tests, migrations, scripts or notes are published" + (stray.length ? ": " + stray.slice(0, 5).join(", ") : ""));
  const h = read("_headers");
  ok(/\/app\/\*[\s\S]*X-Robots-Tag: noindex/.test(h) && /X-Frame-Options: DENY/.test(h) && /X-Content-Type-Options: nosniff/.test(h), "_headers: no framing, no sniffing, the app not indexed");

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
