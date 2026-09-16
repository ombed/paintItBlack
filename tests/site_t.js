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

// relative references in the page
const html = read("index.html");
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/\|\|\s*"\.\/([^"]+)"/g)) refs.add(m[1]);
for (const f of refs) ok("index.html loads " + f + " but the site does not ship it", listed.has(f));
ok("index.html references were found", refs.size >= 5);

// the build copies exactly the list, and nothing from design/ or docs/
const out = build(fs.mkdtempSync(path.join(os.tmpdir(), "site-")));
const got = fs.readdirSync(out).sort();
ok("build output is the list plus .nojekyll", JSON.stringify(got) === JSON.stringify([".nojekyll", ...SITE_FILES].sort()));
ok("no design canvas in the site", !fs.existsSync(path.join(out, "design")));
ok("no archive in the site", !fs.existsSync(path.join(out, "docs")));
fs.rmSync(out, { recursive: true, force: true });

console.log(`  site: ${pass} passed, ${fail} failed`);
module.exports = { pass, fail };
if (fail) process.exitCode = 1;
