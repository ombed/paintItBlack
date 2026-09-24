/* Browser against Node (PLAN.md rule 5) and the browser's costs (rule 3), from the files the
   browser check wrote (out/browser/<model>.json):

     node bench/model-eval/browser/compare.js [model ...]     default: every file there

   1. Model level: every chunk the page ran is run again through the Node pipeline (load.js,
      the same file and tokenizer), token by token: labels that differ, largest score gap.
   2. The whole chain: the page's raw outputs are replayed through bench/lib.js runAll (a
      pipeline that answers each chunk with what the page answered), and found and leaked are
      set against the Node run of the same model (product.js, out/product/). The rule: a
      candidate may drift no more than the baseline drifts, plus 1, on found and on leaked.
   3. Scan time per 1k words and peak memory, against today's model in the browser.
   Writes out/browser/compare.md. Invented text only (the synthetic corpus). */
const fs = require("fs");
const path = require("path");
const E = require("../../engine.js");
const { makeBench } = require("../../lib.js");
const { compare } = require("../../gate.js");
const { loadModel, getSpec } = require("../load.js");
const { wrapPipe } = require("../wrap.js");

const OUT = path.join(__dirname, "..", "out", "browser");
const PRODUCT = path.join(__dirname, "..", "out", "product");
// the Node whole-chain run of each row (product.js tags)
const NODE_RUN = (name) => (name === "base-q8" ? "base-q8-a.json" : name.replace(/-ft$/, "") + (/-ft$/.test(name) ? "-full-ft.json" : "-full.json"));

function replayPipe(chunks) {
  const by = new Map(chunks.map((c) => [c.t, c.r]));
  let missing = 0;
  const pipe = async (t) => { if (!by.has(t)) { missing++; return []; } return JSON.parse(JSON.stringify(by.get(t))); };
  pipe.missing = () => missing;
  return pipe;
}
const totals = (R) => { const s = R.rows.filter((r) => r.found !== null); return { found: s.filter((r) => r.found).length, leaked: R.totals.leaked }; };

async function one(name) {
  const B = read(name);
  const key = name.replace(/-ft$/, ""), spec = getSpec(key);
  const node = await loadModel(key, { tok: /-ft$/.test(name) ? "faithful" : "product" });
  // 1. token by token
  let tokens = 0, labelDiff = 0, maxGap = 0, chunks = 0;
  for (const d of B.docs) for (const c of d.raw) {
    chunks++;
    const r = await node(c.t, { ignore_labels: [] });
    const n = Math.max(r.length, c.r.length);
    for (let i = 0; i < n; i++) {
      tokens++;
      const a = c.r[i], b = r[i];
      if (!a || !b || a.entity !== b.entity || a.word !== b.word) { labelDiff++; continue; }
      maxGap = Math.max(maxGap, Math.abs(a.score - b.score));
    }
  }
  // 2. the whole chain on the page's outputs
  const replay = replayPipe(B.docs.flatMap((d) => d.raw));
  const Bn = makeBench(E);
  const R = await Bn.runAll(wrapPipe(replay, spec));
  const nodeRun = JSON.parse(fs.readFileSync(path.join(PRODUCT, NODE_RUN(name)), "utf8"));
  const c = compare(nodeRun, R);
  const tb = totals(R), tn = totals(nodeRun);
  return { name, chunks, tokens, labelDiff, maxGap, missingChunks: replay.missing(), browser: tb, node: tn,
    drift: { found: Math.abs(tb.found - tn.found), leaked: Math.abs(tb.leaked - tn.leaked) },
    flips: c.worse.length + c.better.length, msPer1k: B.msPer1kWords, peakMB: B.memory.peakMB, loadMs: B.loadMs };
}
const read = (name) => JSON.parse(fs.readFileSync(path.join(OUT, name + ".json"), "utf8"));

async function main(names) {
  const list = names.length ? names : fs.readdirSync(OUT).filter((f) => /\.json$/.test(f)).map((f) => f.replace(/\.json$/, ""));
  if (!list.includes("base-q8")) throw new Error("the baseline's browser run (base-q8) is needed: its drift is the rule's allowance");
  const rows = [];
  for (const n of ["base-q8", ...list.filter((x) => x !== "base-q8")]) { rows.push(await one(n)); console.log("done " + n); }
  const base = rows[0];
  const L = ["| Model | Chunks | Tokens with another label than Node | Largest score gap | Found browser / Node | Leaked browser / Node | Entities that differ | Rule 5 | ms per 1k words (vs today) | Peak MB (vs today) | Load ms |",
    "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    const ok = r.drift.found <= base.drift.found + 1 && r.drift.leaked <= base.drift.leaked + 1 && !r.missingChunks;
    L.push(`| ${r.name} | ${r.chunks} | ${r.labelDiff} of ${r.tokens} | ${r.maxGap.toExponential(1)} | ${r.browser.found} / ${r.node.found} | ${r.browser.leaked} / ${r.node.leaked} | ${r.flips} | ${r.name === "base-q8" ? "baseline" : ok ? "PASS" : "FAIL"} | ${r.msPer1k} (${(r.msPer1k / base.msPer1k).toFixed(2)}×) | ${r.peakMB} (${(r.peakMB / base.peakMB).toFixed(2)}×) | ${r.loadMs} |`);
  }
  const md = L.join("\n") + "\n";
  fs.writeFileSync(path.join(OUT, "compare.md"), md);
  console.log(md);
}

if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e && e.stack || e); process.exitCode = 1; });
