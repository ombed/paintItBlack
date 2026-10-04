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
   - _headers: no framing, no sniffing, the app kept out of search engines;
   - _routes.json: the gate runs in front of every request except the site's own public files,
     each named exactly (no pattern an encoded path could slip into). Exact names also keep
     the landing page off the daily Functions quota.
   tests/hosted_t.js checks the result. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { SITE_FILES } = require("./build-site.js");
const { hostedApp, resourcesScript, LIBS, ORT_FILES, ortFrom, ortPin, ORT_DIR, FONTS, FONT_SUBSETS } = require("./hosted.js");

const ROOT = path.resolve(__dirname, "..");
const LIMIT = 25 * 1024 * 1024; // Cloudflare Pages: no file over 25 MiB
const PARTS = 8;
const MARK = ".inkognito-build";

const HEADERS = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/app/*
  X-Robots-Tag: noindex
`;
const ROUTE_LIMIT = 100; // Cloudflare Pages: at most 100 include and exclude rules together

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

function build(out) {
  if (path.basename(out).startsWith("-")) throw new Error("not a folder name: " + path.basename(out));
  if (!safeToReplace(out)) throw new Error("refusing to delete " + out + ": it is not a folder this script built");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, MARK), "");

  const site = path.join(ROOT, "site");
  if (!fs.existsSync(path.join(site, "vendor"))) throw new Error("site/vendor/ is missing: run npm install (scripts/vendor.js)");
  copyTree(site, out);

  const model = SITE_FILES.filter((f) => /\.part\d+$/.test(f));
  for (const f of SITE_FILES.filter((x) => !model.includes(x))) {
    const to = path.join(out, "app", f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), to);
  }
  fs.writeFileSync(path.join(out, "app", "index.html"), hostedApp(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")));

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

  // the fonts: the Hebrew and Latin faces of each weight the tool asks Google Fonts for
  let css = "/* Generated by scripts/build-hosted.js from @fontsource (OFL): the fonts the tool asked Google Fonts for. */\n";
  for (const [family, weights] of FONTS) for (const w of weights) {
    const src = fs.readFileSync(path.join(ROOT, "node_modules/@fontsource", family, w + ".css"), "utf8");
    for (const block of src.split(/(?=\/\* [a-z-]+-\d+-normal \*\/)/).filter((b) => FONT_SUBSETS.test(b))) {
      for (const m of block.matchAll(/url\(\.\/files\/([^)]+)\)/g)) put("fonts/" + m[1], fs.readFileSync(path.join(ROOT, "node_modules/@fontsource", family, "files", m[1])));
      css += block.replace(/url\(\.\/files\//g, "url(./").trim() + "\n";
    }
  }
  put("fonts/app-fonts.css", css);

  fs.writeFileSync(path.join(out, "_headers"), HEADERS);

  // the public files skip the gate by exact name; everything else, /app/ above all, meets it
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const pub = walk(out).map((f) => "/" + path.relative(out, f).split(path.sep).join("/"))
    .filter((p) => !/^\/app\//i.test(p) && !/(^|\/)\./.test(p) && !["/_headers", "/_routes.json"].includes(p)).sort();
  if (pub.length + 1 > ROUTE_LIMIT) throw new Error("build-hosted: " + pub.length + " public files exceed Cloudflare's " + ROUTE_LIMIT + " route rules");
  fs.writeFileSync(path.join(out, "_routes.json"), JSON.stringify({ version: 1, include: ["/*"], exclude: pub }, null, 1));
  return out;
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, "dist"));
  build(out);
  console.log("wrote the hosted site to " + out);
}

module.exports = { build, LIMIT };
