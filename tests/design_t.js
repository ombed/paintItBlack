/* design/redact.dc.html is generated from index.html by scripts/build-design.js.
   A stale copy is a red suite: run `npm run build:design` after editing the page. */
const fs = require("fs");
const { build, OUT } = require("../scripts/build-design.js");
const path = require("path");

let pass = 0, fail = 0;
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let want; try { want = build(html); pass++; } catch (e) { fail++; console.log("  FAIL build threw: " + e.message); }
if (want !== undefined) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (have === want) pass++; else {
    fail++;
    const a = have.split(/\r?\n/), b = want.split(/\r?\n/);
    const i = a.findIndex((l, k) => l !== b[k]);
    console.log("  FAIL design/redact.dc.html is stale; first difference at line " + (i + 1) + "\n    have: " + (a[i] || "").slice(0, 90) + "\n    want: " + (b[i] || "").slice(0, 90) + "\n  run: npm run build:design");
  }
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
