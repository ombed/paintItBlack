/* The whole chain with a registry model (PLAN.md run order 1 and 2: parity, noise band).

     node bench/model-eval/product.js [--model=base-q8] [--tag=a] [--against=baseline|<tag>|<model>:<tag>]
          [--loader=today] [--tok=product|faithful]

   Runs bench/lib.js runAll, unchanged, on the synthetic corpus and, when they are present,
   on her fixtures, with the model loaded through the model-eval loader (pinned revision,
   own cache, sha256 checked). Prints PLAN.md's row: scored, found, missed, leaked, fp, junk.

   Rows are written where they may live, never to bench/results* or private-bench/results*:
     synthetic  bench/model-eval/out/product/<model>-<tag>.json   (invented text; gitignored)
     hers       private-bench/model-eval/product/<model>-<tag>.json

   --against compares entity by entity with gate.js's compare: "baseline" is the committed
   bench/results.json and private-bench/results.json (today's loader, model on); a tag is an
   earlier run of this script with the same model, <model>:<tag> one with another model. Her
   part prints counts only, through the privacy gate. */
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");
const { makeBench, loadModel, KEY } = require("../lib.js");
const PRIVATE = require("../private.js");
const { compare } = require("../gate.js");
const { getSpec, seed } = require("./load.js");
const privacy = require("./privacy.js");
const { wrapPipe } = require("./wrap.js");

const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const MODEL = arg("model", "base-q8"), TAG = arg("tag", "a"), AGAINST = arg("against", "");
// --loader=today: the same model through today's bench loader, to tell a loader difference
// from a fixture that changed since the committed baseline was run
const TODAY = arg("loader", "") === "today";
// --tok=faithful: the same model with its tokenizer as trained (load.js, tokfix.js)
const TOK = arg("tok", "product");
if (TODAY && TOK !== "product") throw new Error("--loader=today has the product tokenizer only");
if (TODAY && MODEL !== "base-q8") throw new Error("--loader=today loads base-q8 only");
if (!/^[a-z0-9.-]+$/.test(TAG) || (AGAINST && !/^(?:[a-z0-9.-]+:)?[a-z0-9.-]+$/.test(AGAINST))) throw new Error("--tag and --against are short lower-case names");
// --against=<tag> is this model's earlier run; <model>:<tag> another model's (q8 against uint8)
const againstFile = (dir) => { const [m, t] = AGAINST.includes(":") ? AGAINST.split(":") : [MODEL, AGAINST]; return path.join(dir, `${m}-${t}.json`); };

const OUT = path.join(__dirname, "out", "product");
const TODAY_FILE = path.join(__dirname, "..", "..", "node_modules", "@huggingface", "transformers", ".cache",
  "onnx-community", "dictabert-ner-ONNX", "onnx", "model_quantized.onnx");

// PLAN.md's columns; "scored" is every must entity (found or not), traps and public bodies apart
function row(R) {
  const scored = R.rows.filter((r) => r.found !== null);
  return { scored: scored.length, found: scored.filter((r) => r.found).length, missed: R.totals.missed,
    leaked: R.totals.leaked, fp: R.totals.fp, junk: R.totals.junk };
}
const flips = (c) => ({ worse: c.worse.length, better: c.better.length, added: c.added.length, gone: c.gone.length });
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

(async () => {
  if (!TODAY && MODEL === "base-q8") seed(getSpec(MODEL), TODAY_FILE);
  const B = makeBench(E);
  const t0 = Date.now();
  // every registry row goes through the adapter (wrap.js); today's loader hands the raw pipeline
  const pipe = TODAY ? await loadModel() : wrapPipe(await loadModel(MODEL, { tok: TOK }), getSpec(MODEL));
  const loadMs = Date.now() - t0;

  // the synthetic corpus: invented text, so ids and names may be printed
  const S = await B.runAll(pipe);
  if (pipe.unmapped) { console.error(`harness error: ${pipe.unmapped} labels with no mapping`); process.exitCode = 2; }
  fs.mkdirSync(OUT, { recursive: true });
  const sFile = path.join(OUT, `${MODEL}-${TAG}.json`);
  fs.writeFileSync(sFile, JSON.stringify({ model: MODEL, tag: TAG, rows: S.rows, unlisted: S.unlisted, totals: S.totals }, null, 1) + "\n");
  console.log(`synthetic ${MODEL} ${TAG}: ` + Object.entries(row(S)).map(([k, v]) => `${k} ${v}`).join(", ") + ` (load ${loadMs} ms)`);
  if (AGAINST) {
    const base = AGAINST === "baseline" ? readJson(path.join(__dirname, "..", "results.json")) : readJson(againstFile(OUT));
    if (!base) console.log(`  no ${AGAINST} run to compare with`);
    else {
      const c = compare(base, S);
      console.log(`  against ${AGAINST}: ` + Object.entries(flips(c)).map(([k, v]) => `${k} ${v}`).join(", "));
      for (const x of [...c.worse, ...c.better, ...c.added, ...c.gone]) console.log("    " + x);
    }
  }

  // her fixtures: rows stay beside them; the console gets numbers only
  const priv = PRIVATE.load();
  if (!priv.docs.length) return;
  await privacy.wrapErrors(async () => {
    const P = await B.runAll(pipe, null, priv.docs);
    const dir = path.join(priv.dir, "model-eval", "product");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${MODEL}-${TAG}.json`), JSON.stringify({ model: MODEL, tag: TAG, rows: P.rows, unlisted: P.unlisted, totals: P.totals }, null, 1) + "\n");
    // the tag is a free name: kept out of the line, the gate would refuse it as a word
    privacy.safeLog("private", MODEL, row(P));
    if (AGAINST) {
      const base = AGAINST === "baseline" ? readJson(path.join(priv.dir, "results.json")) : readJson(againstFile(dir));
      if (!base) privacy.safeLog("private", "no", "baseline");
      else privacy.safeLog("private", "vs", flips(compare(base, P)));
    }
  });
})().catch((e) => {
  // a private run's error goes through the gate's sanitiser: no message text, no document text
  console.error(privacy.sanitise(e).stack);
  process.exitCode = 1;
});
