/* Builds _site/: exactly the files the tool loads at runtime, nothing else.

     node scripts/build-site.js [outDir]

   GitHub Pages used to publish the whole repository, so design/redact.dc.html
   and docs/archive/standalone-original.html were public pages that rendered
   raw {{ }} placeholders and a broken support.js (QA run-1 ISSUE-011), next to
   tests, benchmarks and planning notes. .github/workflows/pages.yml publishes
   this folder instead, after a browser check runs against it.

   The list matches the README deployment table; tests/site_t.js keeps the
   two, and the service worker's cache list, in agreement. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_FILES = [
  "index.html", "support.js", "page-logic.js", "redact-engine.js", "pdf-text.js",
  "text-to-docx.js", "sw.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
];

/* The output folder is deleted before it is rebuilt, so what may be named is narrow: an
   existing folder is only removed if this script made it, which means it holds .nojekyll
   and nothing but the site files. Before this check the path was whatever was typed:
   "node scripts/build-site.js --list" built a folder called --list, and a slip of the hand
   next to "npm run shapes ../private-bench" would have deleted the client fixtures
   (review M9). */
function safeToReplace(out) {
  if (!fs.existsSync(out)) return true;
  if (!fs.statSync(out).isDirectory()) return false;
  const names = fs.readdirSync(out);
  if (!names.length) return true;
  return names.includes(".nojekyll") && names.every((n) => n === ".nojekyll" || SITE_FILES.includes(n));
}

function build(out) {
  if (path.basename(out).startsWith("-")) throw new Error("not a folder name: " + path.basename(out));
  if (!safeToReplace(out)) throw new Error("refusing to delete " + out + ": it is not a folder this script built");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of SITE_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(out, f));
  // served as-is: no Jekyll pass over index.html's {{ }} template syntax
  fs.writeFileSync(path.join(out, ".nojekyll"), "");
  return out;
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, "_site"));
  build(out);
  console.log(`wrote ${SITE_FILES.length} files to ${out}`);
}

module.exports = { SITE_FILES, build };
