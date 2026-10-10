/* Bumps the version everywhere at once:
     node scripts/bump.js 74     a release: a batch of improvements users are told about
     node scripts/bump.js fix    a small fix: v73 → v73.1 → v73.2, the same release for users

   The owner's rule (9.10.2026): a new version only after a batch of improvements, the way big apps
   do it, and a small fix is "small bugs fixed" under the version users already have. Every deploy
   still needs a new number, or browsers keep the old files, so a fix is vNN.k: the service worker's
   cache key and the chip move, while «מה חדש» after an update shows only when NN moves.

   Six sites: four in index.html (the chip, the console line, the comparison against what the
   service worker served, the warning label), the cache key in sw.js, and the README table with its
   line numbers. tests/version_t.js asserts they agree, so a site missed by hand is a red suite
   rather than a stale cache on a phone. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VER = "v\\d+(?:\\.\\d+)?";
const parse = (v) => { const m = /^v?(\d+)(?:\.(\d+))?$/.exec(String(v || "")); return m ? [Number(m[1]), Number(m[2] || 0)] : null; };
const show = ([n, k]) => "v" + n + (k ? "." + k : "");

// The chip is the only version she can report and the only thing the deploy check reads, so it
// only moves forward (review L2). A rollback publishes an older tag; it does not bump backwards.
const curText = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(new RegExp("גרסה (" + VER + ")")) || [])[1];
const cur = parse(curText);
const arg = process.argv[2];
const want = arg === "fix" ? (cur ? [cur[0], cur[1] + 1] : null) : parse(arg);
if (!want || !want[0] || (arg !== "fix" && !/^v?\d+(\.[1-9]\d*)?$/.test(arg))) {
  console.error("usage: node scripts/bump.js <release number> | fix   (e.g. 74, or fix for v73 → v73.1)");
  process.exit(2);
}
const V = show(want);
const newer = !cur || want[0] > cur[0] || (want[0] === cur[0] && want[1] > cur[1]);
if (!newer && !process.argv.includes("--force")) {
  console.error(`the site is at ${show(cur)}; ${V} is not newer (add --force to insist)`);
  process.exit(2);
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const rx = (src) => new RegExp(src.replace(/VER/g, VER), "m");

// index.html: every version that sits in one of the four known shapes
let html = read("index.html");
const shapes = [
  [rx('(<div id="ver">גרסה )VER(<\\/div>)'), "$1" + V + "$2"],
  [rx('(console\\.log\\("אינקוגניטו — גרסה )VER("\\))'), "$1" + V + "$2"],
  [rx('(if\\(served===")VER("\\) return;)'), "$1" + V + "$2"],
  [rx("(el\\.innerHTML='גרסה )VER( · )"), "$1" + V + "$2"],
];
for (const [re, rep] of shapes) {
  if (!re.test(html)) { console.error("index.html: site not found: " + re); process.exit(1); }
  html = html.replace(re, rep);
}
write("index.html", html);

let sw = read("sw.js");
const key = rx('const V="hedact-VER";');
if (!key.test(sw)) { console.error("sw.js: cache key not found"); process.exit(1); }
write("sw.js", sw.replace(key, 'const V="hedact-' + V + '";'));

// README: the table rows carry the line number and the string; refresh both
const lines = html.split("\n");
const lineOf = (re) => lines.findIndex((l) => re.test(l)) + 1;
let md = read("README.md");
const rows = [
  [rx('^\\| `index\\.html` \\| \\d+ \\| `<div id="ver">גרסה VER<\\/div>`'), "| `index.html` | " + lineOf(/<div id="ver">/) + ' | `<div id="ver">גרסה ' + V + "</div>`"],
  [rx('^\\| `index\\.html` \\| \\d+ \\| `console\\.log\\("… גרסה VER"\\)`'), "| `index.html` | " + lineOf(/console\.log\("אינקוגניטו — גרסה/) + ' | `console.log("… גרסה ' + V + '")`'],
  [rx('^\\| `index\\.html` \\| \\d+ \\| `if\\(served==="VER"\\) return;`'), "| `index.html` | " + lineOf(/if\(served===/) + ' | `if(served==="' + V + '") return;`'],
  [rx("^\\| `index\\.html` \\| \\d+ \\| `el\\.innerHTML='גרסה VER · …'`"), "| `index.html` | " + lineOf(/el\.innerHTML='גרסה/) + " | `el.innerHTML='גרסה " + V + " · …'`"],
  [rx('^\\| `sw\\.js` \\| \\d+ \\| `const V="hedact-VER";`'), "| `sw.js` | " + (sw.split("\n").findIndex((l) => /const V="hedact-/.test(l)) + 1) + ' | `const V="hedact-' + V + '";`'],
  [rx("מספרי השורות נכונים לגרסה VER"), "מספרי השורות נכונים לגרסה " + V],
];
for (const [re, rep] of rows) {
  if (!re.test(md)) { console.error("README.md: row not found: " + re); process.exit(1); }
  md = md.replace(re, rep);
}
write("README.md", md);
console.log("bumped to " + V + (want[1] ? " (a small fix of v" + want[0] + ")" : " (a release)") + " in index.html (4), sw.js (1), README.md (6)");
