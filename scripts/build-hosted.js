/* Builds dist/: what Cloudflare Pages serves at inkognito.co.il.

     node scripts/build-hosted.js [outDir]
     npx wrangler pages deploy dist      (from the repository root, so functions/ goes too)

   - the root: the landing site, sign-in and legal pages (site/), with the sign-in client;
   - /app/: exactly the files the tool loads (scripts/build-site.js SITE_FILES), its page with
     the hosted injection (scripts/hosted.js), behind the gate (functions/app/_middleware.js);
   - the model's weights re-split under Cloudflare's 25 MiB file cap, and this build's copy of
     the engine told the new part names. Joined, they are the same bytes: the page checks the
     SHA-256. The repository's model files and the public tool are untouched;
   - _headers: no framing, no sniffing, the app kept out of search engines.
   tests/hosted_t.js checks the result. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { SITE_FILES } = require("./build-site.js");
const { hostedApp } = require("./hosted.js");

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
  Cache-Control: private, no-cache
`;

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
    const name = spec[1] + ".part" + (i + 1); // onnx/model_quantized.onnx.partN
    fs.writeFileSync(path.join(out, "app", path.posix.dirname(dirOf), name), whole.subarray(i * size, Math.min(whole.length, (i + 1) * size)));
    names.push(name);
  }
  const list = "parts:[" + names.map((n) => JSON.stringify(n)).join(",") + "]";
  fs.writeFileSync(path.join(out, "app", "redact-engine.js"), eng.replace(/parts:\[[^\]]*\]/, list));

  fs.writeFileSync(path.join(out, "_headers"), HEADERS);
  return out;
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, "dist"));
  build(out);
  console.log("wrote the hosted site to " + out);
}

module.exports = { build, LIMIT };
