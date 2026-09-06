/* Recall gate. Compares the deterministic benchmark just run against the
   committed baseline and reports any regression in leaks or misses per
   category. Report-only for now: it prints, it never fails the build.
   Flip GATE_BLOCKING=1 once the numbers have held still for a few runs. */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const cur = JSON.parse(fs.readFileSync(path.join(HERE, "results-no-model.json"), "utf8"));
const basePath = path.join(HERE, "baseline-no-model.json");
if (!fs.existsSync(basePath)) {
  console.log("gate: no baseline yet; copy results-no-model.json to baseline-no-model.json to start comparing");
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));

const tally = (r) => {
  const out = {};
  for (const row of r.rows || []) {
    const t = out[row.cat] || (out[row.cat] = { leaked: 0, missed: 0, fp: 0 });
    if (row.leaked) t.leaked++;
    if (row.found === false) t.missed++;
    t.fp += row.fp || 0;
  }
  return out;
};
const a = tally(base), b = tally(cur);
const worse = [], better = [];
for (const cat of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const x = a[cat] || { leaked: 0, missed: 0, fp: 0 }, y = b[cat] || { leaked: 0, missed: 0, fp: 0 };
  for (const k of ["leaked", "missed", "fp"]) {
    if (y[k] > x[k]) worse.push(`${cat}: ${k} ${x[k]} → ${y[k]}`);
    if (y[k] < x[k]) better.push(`${cat}: ${k} ${x[k]} → ${y[k]}`);
  }
}
const sum = (t, k) => Object.values(t).reduce((n, r) => n + r[k], 0);
console.log(`gate: leaks ${sum(a, "leaked")} → ${sum(b, "leaked")}, missed ${sum(a, "missed")} → ${sum(b, "missed")}, fp ${sum(a, "fp")} → ${sum(b, "fp")}`);
for (const l of better) console.log("  better  " + l);
for (const l of worse) console.log("  WORSE   " + l);
if (worse.length && process.env.GATE_BLOCKING) { console.log("gate: blocking"); process.exit(1); }
if (worse.length) console.log("gate: report only, not blocking");
