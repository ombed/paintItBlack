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
// an extension may end in digits: the model's weights ship as model_quantized.onnx.part1 …
const inTable = [...table.matchAll(/`([^`]+\.[a-z][a-z0-9]*)`/g)].map((m) => m[1]).filter((f) => !f.startsWith("file:") && !f.startsWith("import"));
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
    for (const f of swFiles) ok("sw.js caches " + f + " but does not serve it from the cache", MINE.test("/inkognito/" + f));
  }
}
// what the tool needs to start and to look right offline is kept at install, not only once asked for
// while the worker controls the page (found live on v60: the first visit's React and the fonts of a
// screen not yet opened were missing offline): every font the site ships, and the React the runtime loads
{
  const m = sw.match(/const KEEP=(\[[^\]]*\])/);
  ok("sw.js has a KEEP list it installs", !!m && /\[\.\.\.FILES,\.\.\.KEEP\]\.map\(f=>c\.add\(f\)\)/.test(sw));
  if (m) {
    const keep = JSON.parse(m[1]);
    const shipped = SITE_FILES.filter((x) => /^fonts\/.*\.woff2$/.test(x)).map((x) => "./" + x).sort();
    ok("sw.js keeps exactly the fonts the site ships", JSON.stringify(keep.filter((x) => x.startsWith("./fonts/")).sort()) === JSON.stringify(shipped));
    const support = read("support.js");
    const react = ["REACT_URL", "REACT_DOM_URL"].map((k) => (support.match(new RegExp("var " + k + ' = "([^"]+)"')) || [])[1]);
    ok("sw.js keeps the React and ReactDOM the runtime loads", react.every((u) => u && keep.includes(u)));
    ok("sw.js keeps nothing but the fonts and the runtime's React", keep.every((x) => x.startsWith("./fonts/") || react.includes(x)));
  }
}

// relative references in the page
const html = read("index.html");
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/\|\|\s*"\.\/([^"]+)"/g)) refs.add(m[1]);
// a CSS url() is a reference too: an @font-face whose file the list forgets would 404 only on the
// live site, and a missing font fails silently (the browser draws a fallback)
for (const m of html.matchAll(/url\(\s*['"]?\.\/([^'")?#]+)/g)) refs.add(m[1]);
// a bare import("./x.js") with no fallback in front of it (review M8): the four runtime modules were
// caught only because each happens to be written as `something || "./x.js"`. The same goes for
// every runtime file that imports a sibling.
const dyn = /import\(\s*(?:\/\*[^*]*\*\/\s*)?["'`]\.\/([^"'`]+)["'`]\s*\)/g;
for (const m of html.matchAll(dyn)) refs.add(m[1]);
for (const f of SITE_FILES.filter((x) => /\.js$/.test(x) && x !== "support.js")) for (const m of read(f).matchAll(dyn)) refs.add(m[1]);
for (const f of refs) ok("index.html loads " + f + " but the site does not ship it", listed.has(f));
ok("index.html references were found", refs.size >= 5);

// the fonts come from the site itself, not from Google Fonts: every font file shipped is named by an
// @font-face rule, each family travels with its licence, nothing names Google's hosts any more, and the
// service worker keeps the fonts cache-first, as it kept Google's
{
  // only a url() inside an @font-face rule counts, and only a rule that opens with the family: a CSS rule
  // that merely names the family (body{font-family:'Rubik'…}) declares no face
  const faces = new Set([...html.matchAll(/@font-face\{[^}]*url\(\.\/(fonts\/[^)]+)\)/g)].map((m) => m[1]));
  for (const f of SITE_FILES.filter((x) => /^fonts\/.*\.woff2$/.test(x))) ok("the site ships " + f + " but no @font-face names it", faces.has(f));
  ok("the site ships the font files", SITE_FILES.filter((x) => /^fonts\/.*\.woff2$/.test(x)).length >= 19);
  for (const fam of ["Rubik", "Noto Serif Hebrew", "Frank Ruhl Libre"]) ok("no @font-face for " + fam, html.includes("@font-face{font-family:'" + fam + "'"));
  for (const fam of ["rubik", "noto-serif-hebrew", "frank-ruhl-libre"])
    ok("no licence shipped for " + fam, listed.has("fonts/" + fam + "-LICENSE.txt") && /SIL Open Font License/.test(read("fonts/" + fam + "-LICENSE.txt")));
  ok("index.html or sw.js still names Google Fonts", !/fonts\.(googleapis|gstatic)\.com/.test(html + sw));
  ok("sw.js does not keep the fonts cache-first", sw.includes('u.pathname.includes("/fonts/")'));
}

// the drawn icons are Lucide's, inlined in the page: their notices travel with it, the ISC licence
// and, for the icons Lucide took from Feather, the MIT licence
if (/data-icon="/.test(html)) {
  ok("index.html draws Lucide icons without Lucide's ISC notice", /Copyright \(c\) \d{4} Lucide Icons and Contributors/.test(html) && /Permission to use, copy, modify, and\/or distribute this software/.test(html));
  ok("index.html draws Feather-derived icons without Feather's MIT notice", /Copyright \(c\) 2013-present Cole Bemis/.test(html) && /Permission is hereby granted, free of charge/.test(html));
}

// a vendored library is loaded through a constant, not a literal import (review H14): every
// "./vendor/..." path a runtime file names is shipped, and every shipped vendor file is named
{
  const named = new Set();
  for (const f of SITE_FILES.filter((x) => /\.m?js$/.test(x) && !x.startsWith("vendor/")))
    for (const m of read(f).matchAll(/["'`]\.\/(vendor\/[^"'`$]+)["'`]/g)) if (/\.m?js$/.test(m[1])) named.add(m[1]);
  const eng = read("engine/08-docx.js"), v = (eng.match(/const ORT_V="([^"]+)"/) || [])[1];
  for (const k of Object.keys(JSON.parse("{" + (eng.match(/const ORT_WASM=\{([^}]*)\}/) || ["", ""])[1] + "}"))) named.add("vendor/ort-" + v + "/" + k + ".mjs");
  for (const f of named) ok("a runtime file loads " + f + " but the site does not ship it", listed.has(f));
  for (const f of SITE_FILES.filter((x) => x.startsWith("vendor/"))) ok("the site ships " + f + " but nothing loads it", named.has(f));
  // pdf.js: the vendored folder is the version package.json pins, so the tests and she run one library
  const want = (read("pdf-text.js").match(/vendor\/pdfjs-([0-9.]+)\//) || [])[1];
  const have = (JSON.parse(read("package.json")).devDependencies || {})["pdfjs-dist"];
  ok("pdf-text.js loads pdfjs " + want + " and package.json pins " + have, !!want && have === want);
}

// the build copies exactly the list, and nothing from design/ or docs/
const out = build(fs.mkdtempSync(path.join(os.tmpdir(), "site-")));
const walk = (d, pre = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), pre + e.name + "/") : [pre + e.name]);
const got = walk(out).sort();
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
