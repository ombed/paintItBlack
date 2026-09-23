/* The baseline's noise band (PLAN.md 1, run order 2): the entities whose outcome flips between
   runs of the baseline that should agree, so the rule does not blame a candidate for them.

     node bench/model-eval/noise.js base-q8:a base-q8:today base-uint8:a

   Every run named (product.js output) is compared with the first, entity by entity (gate.js's
   compare: now leaks, now missed, fp changed, and the reverse). An entity that flips in any
   pair is in the band. Written where each set may live:
     synthetic  bench/model-eval/noise-band.json         (invented names; committed)
     hers       private-bench/model-eval/noise-band.json (her entity ids never leave it)
   Her part prints counts only, through the privacy gate. */
const fs = require("fs");
const path = require("path");
const { compare } = require("../gate.js");
const PRIVATE = require("../private.js");
const privacy = require("./privacy.js");


// the entity id gate.js compares on: the text before the first ": " of each flip line
const idOf = (line) => line.slice(0, line.indexOf(": "));

function band(dir, runs) {
  if (runs.length < 2 || runs.some((r) => !/^[a-z0-9.-]+:[a-z0-9.-]+$/.test(r))) throw new Error("name two or more runs as <model>:<tag>");
  const files = runs.map((r) => path.join(dir, r.replace(":", "-") + ".json"));
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) return { missing: missing.length };
  const [first, ...rest] = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const ids = new Set(), pairs = [];
  rest.forEach((r, i) => {
    const c = compare(first, r);
    const flipped = new Set([...c.worse, ...c.better].map(idOf));
    for (const x of flipped) ids.add(x);
    pairs.push({ against: runs[i + 1], worse: c.worse.length, better: c.better.length, entities: flipped.size });
  });
  return { base: runs[0], pairs, entities: [...ids].sort() };
}

function main(runs) {
  const S = band(path.join(__dirname, "out", "product"), runs);
  if (S.missing) throw new Error("run product.js for each named run first");
  fs.writeFileSync(path.join(__dirname, "noise-band.json"), JSON.stringify(S, null, 1) + "\n");
  console.log(`synthetic: ${S.entities.length} entities in the band`);
  for (const p of S.pairs) console.log(`  ${S.base} vs ${p.against}: ${p.entities} flip (worse ${p.worse}, better ${p.better})`);

  const priv = PRIVATE.load();
  if (!priv.docs.length) return;
  privacy.wrapErrors(() => {
    const dir = path.join(priv.dir, "model-eval");
    const P = band(path.join(dir, "product"), runs);
    if (P.missing) { privacy.safeLog("private", "skip", P.missing); return; }
    fs.writeFileSync(path.join(dir, "noise-band.json"), JSON.stringify(P, null, 1) + "\n");
    privacy.safeLog("private", "noise", "band", { count: P.entities.length });
    for (const p of P.pairs) privacy.safeLog("private", { worse: p.worse, better: p.better, count: p.entities });
  });
}

module.exports = { band };
if (require.main === module) main(process.argv.slice(2));
