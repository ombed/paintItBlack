/* Bumps the version everywhere at once:  node scripts/bump.js 14

   Six sites: four in index.html (the chip, the console line, the
   comparison against what the service worker served, the warning label),
   the cache key in sw.js, and the README table with its line numbers.
   tests/version_t.js asserts they agree, so a site missed by hand is a
   red suite rather than a stale cache on a phone. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const n = Number(process.argv[2]);
if (!Number.isInteger(n) || n < 1) { console.error("usage: node scripts/bump.js <number>"); process.exit(2); }
const V = "v" + n;

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

// index.html: every "vNN" that sits in one of the four known shapes
let html = read("index.html");
const shapes = [
  [/(<div id="ver">גרסה )v\d+(<\/div>)/, "$1" + V + "$2"],
  [/(console\.log\("השחרת מסמכים — גרסה )v\d+("\))/, "$1" + V + "$2"],
  [/(if\(served===")v\d+("\) return;)/, "$1" + V + "$2"],
  [/(el\.innerHTML='גרסה )v\d+( · )/, "$1" + V + "$2"],
];
for (const [rx, rep] of shapes) {
  if (!rx.test(html)) { console.error("index.html: site not found: " + rx); process.exit(1); }
  html = html.replace(rx, rep);
}
write("index.html", html);

let sw = read("sw.js");
if (!/const V="hedact-v\d+";/.test(sw)) { console.error("sw.js: cache key not found"); process.exit(1); }
write("sw.js", sw.replace(/const V="hedact-v\d+";/, 'const V="hedact-' + V + '";'));

// README: the table rows carry the line number and the string; refresh both
const lines = html.split("\n");
const lineOf = (rx) => lines.findIndex((l) => rx.test(l)) + 1;
let md = read("README.md");
const rows = [
  [/^\| `index\.html` \| \d+ \| `<div id="ver">גרסה v\d+<\/div>`/m, "| `index.html` | " + lineOf(/<div id="ver">/) + ' | `<div id="ver">גרסה ' + V + "</div>`"],
  [/^\| `index\.html` \| \d+ \| `console\.log\("… גרסה v\d+"\)`/m, "| `index.html` | " + lineOf(/console\.log\("השחרת מסמכים — גרסה/) + ' | `console.log("… גרסה ' + V + '")`'],
  [/^\| `index\.html` \| \d+ \| `if\(served==="v\d+"\) return;`/m, "| `index.html` | " + lineOf(/if\(served===/) + ' | `if(served==="' + V + '") return;`'],
  [/^\| `index\.html` \| \d+ \| `el\.innerHTML='גרסה v\d+ · …'`/m, "| `index.html` | " + lineOf(/el\.innerHTML='גרסה/) + " | `el.innerHTML='גרסה " + V + " · …'`"],
  [/^\| `sw\.js` \| \d+ \| `const V="hedact-v\d+";`/m, "| `sw.js` | " + (sw.split("\n").findIndex((l) => /const V="hedact-/.test(l)) + 1) + ' | `const V="hedact-' + V + '";`'],
  [/מספרי השורות נכונים לגרסה v\d+/, "מספרי השורות נכונים לגרסה " + V],
];
for (const [rx, rep] of rows) {
  if (!rx.test(md)) { console.error("README.md: row not found: " + rx); process.exit(1); }
  md = md.replace(rx, rep);
}
write("README.md", md);
console.log("bumped to " + V + " in index.html (4), sw.js (1), README.md (6)");
