/* Copies the libraries the site serves itself into vendor/ (review H14):

     node scripts/vendor.js        (runs on npm install and npm ci, as "prepare")

   transformers.js and pdf.js come from node_modules, which package-lock.json pins by integrity
   hash, so the repository does not carry third-party bundles: GitHub's secret scanning read a
   minified identifier in transformers.min.js as an API key and refused the push, and a copy in
   git would be one more thing to keep in step with the lock. The file names carry the installed
   versions; tests/site_t.js fails if the code names a version that is not the installed one.
   The runtime's two loaders are not in node_modules at the version transformers.js bundles, so
   they are committed under vendor/ort-<version>/ and pinned by hash in tests/vendor_t.js. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const version = (pkg) => JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", pkg, "package.json"), "utf8")).version;
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, to)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), path.join(ROOT, to));
  return to;
};

function vendor() {
  const tv = version("@huggingface/transformers"), pv = version("pdfjs-dist");
  return [
    copy("node_modules/@huggingface/transformers/dist/transformers.min.js", `vendor/transformers-${tv}.min.js`),
    copy("node_modules/pdfjs-dist/build/pdf.min.mjs", `vendor/pdfjs-${pv}/pdf.min.mjs`),
    copy("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", `vendor/pdfjs-${pv}/pdf.worker.min.mjs`),
  ];
}

if (require.main === module) {
  // installed without the dev dependencies (production install): nothing to copy, and nothing to serve
  if (!fs.existsSync(path.join(ROOT, "node_modules", "@huggingface", "transformers"))) { console.log("vendor: node_modules has no transformers.js; skipped"); process.exit(0); }
  console.log("vendor: " + vendor().join(", "));
}
module.exports = { vendor };
