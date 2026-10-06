/* Builds the forward for the tool's old address:  node scripts/build-forward.js <outDir>

   The owner decided on 6.10.2026 to move the public tool to https://inkognito.co.il/. GitHub Pages
   keeps serving the old address, so .github/workflows/pages.yml publishes this folder there instead
   of the tool:
     - index.html, the moved page (forward/index.html): with nothing saved in the browser it sends the
       visitor to inkognito.co.il; with saved cases it offers them as one file, to import there
       («ייבוא תיקים מקובץ»);
     - 404.html, the same page, so an old deep link lands on it too;
     - sw.js, which replaces the tool's service worker, deletes what the tool kept and removes itself;
     - .nojekyll, so Pages serves the files as they are.
   A rollback to a live/vNN tag, which has no such script, publishes the tool again (docs/ROLLBACK.md).
   tests/forward_t.js reads what this writes; e2e/moved.spec.js runs it in a browser. */
const fs = require("fs");
const path = require("path");
const { SITE_FILES } = require("./build-site.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "forward");
const FORWARD_FILES = ["index.html", "404.html", "sw.js"];
// the folder is deleted before it is rebuilt, so only one this script or build-site.js made is replaced:
// it holds .nojekyll and nothing but their files (the same guard as build-site.js, review M9)
const TOP = new Set([...FORWARD_FILES, ...SITE_FILES.map((f) => f.split("/")[0])]);

function safeToReplace(out) {
  if (!fs.existsSync(out)) return true;
  if (!fs.statSync(out).isDirectory()) return false;
  const names = fs.readdirSync(out);
  if (!names.length) return true;
  return names.includes(".nojekyll") && names.every((n) => n === ".nojekyll" || TOP.has(n));
}

function build(out, src = SRC) {
  if (!out) throw new Error("usage: node scripts/build-forward.js <outDir>");
  if (path.basename(out).startsWith("-")) throw new Error("not a folder name: " + path.basename(out));
  if (!safeToReplace(out)) throw new Error("refusing to delete " + out + ": it is not a folder this script or build-site.js built");
  // 404.html answers every old deep link, so it must be the page itself, byte for byte
  if (!fs.readFileSync(path.join(src, "404.html")).equals(fs.readFileSync(path.join(src, "index.html"))))
    throw new Error("forward/404.html is not the same page as forward/index.html");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of FORWARD_FILES) fs.copyFileSync(path.join(src, f), path.join(out, f));
  fs.writeFileSync(path.join(out, ".nojekyll"), "");
  return out;
}

if (require.main === module) {
  if (!process.argv[2]) {
    console.error("usage: node scripts/build-forward.js <outDir>");
    process.exit(2);
  }
  const out = build(path.resolve(process.argv[2]));
  console.log(`wrote ${FORWARD_FILES.join(", ")} and .nojekyll to ${out}`);
}

module.exports = { FORWARD_FILES, build };
