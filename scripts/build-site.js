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

function build(out) {
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
