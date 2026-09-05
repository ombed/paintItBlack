/* The version string lives in six places. All six must agree, or the chip
   on a phone shows the old number next to a "refresh without cache" warning
   that never goes away. scripts/bump.js writes them; this reads them back. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let pass = 0, fail = 0;
const eq = (what, a, b) => { if (a === b) pass++; else { fail++; console.log("  FAIL " + what + ": " + a + " ≠ " + b); } };

const html = read("index.html"), sw = read("sw.js"), md = read("README.md");
const pick = (s, rx, what) => { const m = s.match(rx); if (!m) { fail++; console.log("  FAIL missing: " + what); return null; } return m[1]; };

const chip = pick(html, /<div id="ver">גרסה (v\d+)<\/div>/, "chip");
const log = pick(html, /console\.log\("השחרת מסמכים — גרסה (v\d+)"\)/, "console line");
const served = pick(html, /if\(served==="(v\d+)"\) return;/, "served check");
const warn = pick(html, /el\.innerHTML='גרסה (v\d+) · /, "warning label");
const key = pick(sw, /const V="hedact-(v\d+)";/, "sw cache key");
const readme = pick(md, /מספרי השורות נכונים לגרסה (v\d+)/, "README note");

eq("console line = chip", log, chip);
eq("served check = chip", served, chip);
eq("warning label = chip", warn, chip);
eq("sw cache key = chip", key, chip);
eq("README = chip", readme, chip);
// the README table mentions no other version
const others = [...md.matchAll(/`[^`]*\b(v\d+)\b[^`]*`/g)].map((m) => m[1]).filter((v) => v !== chip);
eq("README table has no stray version", others.join(","), "");
// and the line numbers in the table point at the right lines
const lines = html.split("\n");
for (const m of md.matchAll(/^\| `index\.html` \| (\d+) \| `([^`]+)`/gm)) {
  const n = Number(m[1]); const needle = m[2].replace(/…/g, "");
  const key2 = needle.includes('id="ver"') ? '<div id="ver">' : needle.includes("console") ? "console.log(" : needle.includes("served") ? "if(served===" : "el.innerHTML='גרסה";
  eq("README line " + n + " holds " + key2, (lines[n - 1] || "").includes(key2), true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
