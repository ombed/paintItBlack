/* The published site is an explicit file list (scripts/build-site.js). A file
   the page loads but the list forgets would 404 only on the live site, so the
   list is checked against the README table, the service worker's cache list,
   and every relative script, import and link in index.html. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { SITE_FILES, build } = require("../scripts/build-site.js");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (what, cond) => { if (cond) pass++; else { fail++; console.log("  FAIL " + what); } };

const listed = new Set(SITE_FILES);

// README deployment table
const md = read("README.md");
const table = md.split("## פריסה")[1].split("\n## ")[0].split("\n").filter((l) => l.startsWith("|")).join("\n");
const inTable = [...table.matchAll(/`([^`]+\.[a-z]+)`/g)].map((m) => m[1]).filter((f) => !f.startsWith("file:") && !f.startsWith("import"));
for (const f of inTable) ok("README lists " + f + " but the site does not", listed.has(f));
for (const f of SITE_FILES) ok("site ships " + f + " but the README table does not list it", inTable.includes(f));

// service worker cache list
const sw = read("sw.js");
const swFiles = JSON.parse(sw.match(/const FILES=(\[[^\]]*\])/)[1].replace(/'/g, '"'))
  .map((f) => f.replace(/^\.\//, "")).filter(Boolean);
for (const f of swFiles) ok("sw.js caches " + f + " but the site does not ship it", listed.has(f));
// and it serves from that cache every file it caches (QA run-2 L21: page-logic.js was
// precached but missing from the fetch pattern, so it failed offline)
{
  const m = sw.match(/const MINE=(\/.*\/);/);
  ok("sw.js has a MINE fetch pattern", !!m);
  if (m) {
    const MINE = eval(m[1]);
    for (const f of swFiles) ok("sw.js caches " + f + " but does not serve it from the cache", MINE.test("/paintItBlack/" + f));
  }
}

// relative references in the page
const html = read("index.html");
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/\|\|\s*"\.\/([^"]+)"/g)) refs.add(m[1]);
// a bare import("./x.js") with no fallback in front of it (review M8): the four runtime modules were
// caught only because each happens to be written as `something || "./x.js"`. The same goes for
// every runtime file that imports a sibling.
const dyn = /import\(\s*(?:\/\*[^*]*\*\/\s*)?["'`]\.\/([^"'`]+)["'`]\s*\)/g;
for (const m of html.matchAll(dyn)) refs.add(m[1]);
for (const f of SITE_FILES.filter((x) => /\.js$/.test(x) && x !== "support.js")) for (const m of read(f).matchAll(dyn)) refs.add(m[1]);
for (const f of refs) ok("index.html loads " + f + " but the site does not ship it", listed.has(f));
ok("index.html references were found", refs.size >= 5);

// the browser tests serve pdf.js from node_modules (e2e/helpers.js), so the pinned copy must be the
// version the page asks the CDN for; otherwise the tests pass on a library she does not get
{
  const want = (read("pdf-text.js").match(/pdfjs-dist@([0-9.]+)[/]/) || [])[1];
  const have = (JSON.parse(read("package.json")).devDependencies || {})["pdfjs-dist"];
  ok("pdf-text.js asks for pdfjs-dist " + want + " and package.json pins " + have, !!want && have === want);
}

// the build copies exactly the list, and nothing from design/ or docs/
const out = build(fs.mkdtempSync(path.join(os.tmpdir(), "site-")));
const got = fs.readdirSync(out).sort();
ok("build output is the list plus .nojekyll", JSON.stringify(got) === JSON.stringify([".nojekyll", ...SITE_FILES].sort()));
ok("no design canvas in the site", !fs.existsSync(path.join(out, "design")));
ok("no archive in the site", !fs.existsSync(path.join(out, "docs")));
// the build deletes its target first, so it only ever replaces a folder it made (review M9)
let rebuilt = true; try { build(out); } catch (_) { rebuilt = false; }
ok("its own output can be rebuilt in place", rebuilt);
const foreign = fs.mkdtempSync(path.join(os.tmpdir(), "keep-"));
fs.writeFileSync(path.join(foreign, "client-document.docx"), "x");
let refused = false; try { build(foreign); } catch (_) { refused = true; }
ok("a folder it did not build is refused", refused && fs.existsSync(path.join(foreign, "client-document.docx")));
let dash = false; try { build(path.join(os.tmpdir(), "--list")); } catch (_) { dash = true; }
ok("a flag typed as a path is refused", dash && !fs.existsSync(path.join(os.tmpdir(), "--list")));
fs.rmSync(foreign, { recursive: true, force: true });
fs.rmSync(out, { recursive: true, force: true });

console.log(`  site: ${pass} passed, ${fail} failed`);
module.exports = { pass, fail };
if (fail) process.exitCode = 1;
