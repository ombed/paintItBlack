/* Recall gate. Compares the deterministic benchmark just run against the committed baseline,
   entity by entity, and blocks on any entity that got worse (GATE_BLOCKING=1, as CI runs it).

   It used to tally counts per category, so fixing one entity's leak while breaking another
   in the same category read "71 → 71" and passed (outside review, L19). An entity is now
   compared with itself: document, category and canonical name. One that is new to the
   corpus is reported and does not block; the baseline is updated in the same change, by
   the documented policy of a ratchet gate (test.yml, bench/README.md). */
const fs = require("fs");
const path = require("path");

const id = (row) => row.doc + "|" + row.cat + "|" + row.canonical;
function compare(base, cur) {
  const before = new Map((base.rows || []).map((r) => [id(r), r]));
  const worse = [], better = [], added = [], gone = [];
  for (const r of cur.rows || []) {
    const b = before.get(id(r));
    if (!b) { if (r.leaked || r.found === false || r.fp) added.push(`${id(r)}: ${r.leaked ? "leaked" : r.found === false ? "missed" : "fp " + r.fp}`); continue; }
    before.delete(id(r));
    if (r.leaked && !b.leaked) worse.push(`${id(r)}: now leaks`);
    if (!r.leaked && b.leaked) better.push(`${id(r)}: no longer leaks`);
    if (r.found === false && b.found !== false) worse.push(`${id(r)}: now missed`);
    if (r.found !== false && b.found === false) better.push(`${id(r)}: now found`);
    if ((r.fp || 0) > (b.fp || 0)) worse.push(`${id(r)}: fp ${b.fp || 0} → ${r.fp}`);
    if ((r.fp || 0) < (b.fp || 0)) better.push(`${id(r)}: fp ${b.fp} → ${r.fp || 0}`);
  }
  for (const k of before.keys()) gone.push(k);
  const sum = (r, f) => (r.rows || []).filter(f).length;
  const totals = (r) => ({ leaked: sum(r, (x) => x.leaked), missed: sum(r, (x) => x.found === false), fp: (r.rows || []).reduce((n, x) => n + (x.fp || 0), 0) });
  return { worse, better, added, gone, a: totals(base), b: totals(cur) };
}

if (require.main === module) {
  const HERE = __dirname;
  const cur = JSON.parse(fs.readFileSync(path.join(HERE, "results-no-model.json"), "utf8"));
  const basePath = path.join(HERE, "baseline-no-model.json");
  if (!fs.existsSync(basePath)) {
    console.log("gate: no baseline yet; copy results-no-model.json to baseline-no-model.json to start comparing");
    process.exit(0);
  }
  const g = compare(JSON.parse(fs.readFileSync(basePath, "utf8")), cur);
  console.log(`gate: leaks ${g.a.leaked} → ${g.b.leaked}, missed ${g.a.missed} → ${g.b.missed}, fp ${g.a.fp} → ${g.b.fp}`);
  for (const l of g.better) console.log("  better  " + l);
  for (const l of g.added) console.log("  new     " + l + " (not in the baseline)");
  for (const l of g.gone) console.log("  gone    " + l + " (in the baseline, not in this run)");
  for (const l of g.worse) console.log("  WORSE   " + l);
  if (g.worse.length && process.env.GATE_BLOCKING) { console.log("gate: blocking"); process.exit(1); }
  if (g.worse.length) console.log("gate: report only, not blocking");
}
module.exports = { compare };
