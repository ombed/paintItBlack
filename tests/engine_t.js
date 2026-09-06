/* redact-engine.js is built from engine/ by scripts/build-engine.js. Editing
   the generated file by hand is caught here: run `npm run build:engine`. */
const fs = require("fs");
const { build, OUT, DIR } = require("../scripts/build-engine.js");

let pass = 0, fail = 0;
try {
  const want = build();
  const have = fs.readFileSync(OUT, "utf8");
  if (have === want) pass++;
  else {
    fail++;
    const a = have.split(/\r?\n/), b = want.split(/\r?\n/);
    const i = a.findIndex((l, k) => l !== b[k]);
    console.log("  FAIL redact-engine.js differs from engine/ at line " + (i + 1) + "\n    file:   " + (a[i] || "").slice(0, 90) + "\n    engine: " + (b[i] || "").slice(0, 90) + "\n  edit engine/*.js and run: npm run build:engine");
  }
  // every part is non-empty and the order is stable
  const parts = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  if (parts.length >= 8 && parts.every((f) => fs.statSync(require("path").join(DIR, f)).size > 0)) pass++;
  else { fail++; console.log("  FAIL engine/ has " + parts.length + " parts"); }
} catch (e) { fail++; console.log("  FAIL " + e.message); }
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
