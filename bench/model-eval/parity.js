/* Parity (PLAN.md 5, run order 1, the harness half): the model-eval path must see exactly
   what the benchmark sees today before any candidate is compared through it.

     node bench/model-eval/parity.js [t1 f1 m1]

   For each synthetic document, three span lists, compared on s/e/type (types mapped
   through base-q8's labelMap, dropped types left out) and on score:
     today   bench/lib.js modelSuggest's grouped spans, with today's loader (loadModel())
     loader  the same, with the model-eval loader (pinned revision, own cache, sha256)
     predict bench/model-eval/predict.js raw spans, with the model-eval loader
   predict = loader checks the adapter and runner; loader = today checks the loader.

   Also checks that the tokenizer's pieces line up with the pipeline's token index, which
   the SentencePiece adapter relies on. Prints counts only. The base-q8 file already in
   today's cache is copied into the model-eval cache (sha256 checked) instead of downloaded. */
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");
const lib = require("../lib.js");
const { loadModel, getSpec, seed } = require("./load.js");
const { predict } = require("./predict.js");

const DOCS = process.argv.slice(2).length ? process.argv.slice(2) : ["t1", "f1", "m1"];
const TODAY_FILE = path.join(__dirname, "..", "..", "node_modules", "@huggingface", "transformers", ".cache",
  "onnx-community", "dictabert-ner-ONNX", "onnx", "model_quantized.onnx");

const key = (x) => x.s + ":" + x.e + ":" + x.type;
function compare(a, b) {
  let same = 0, scoreDiff = 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] && b[i] && key(a[i]) === key(b[i])) { same++; scoreDiff = Math.max(scoreDiff, Math.abs(a[i].score - b[i].score)); }
  }
  return { same, a: a.length, b: b.length, equal: same === a.length && same === b.length, scoreDiff };
}

(async () => {
  const spec = getSpec("base-q8");
  const seeded = seed(spec, TODAY_FILE);
  const B = lib.makeBench(E);
  const today = await lib.loadModel();
  const mine = await lib.loadModel("base-q8");
  const map = spec.labelMap;
  const mapped = (rows) => rows.filter((r) => map[r.type]).map((r) => ({ s: r.s, e: r.e, type: map[r.type], score: r.score }));
  console.log("base-q8 file " + (seeded ? "copied from today's cache" : "already in the model-eval cache or downloaded") + "; sha256 checked");

  let ok = true;
  for (const id of DOCS) {
    const doc = B.KEY.docs.find((d) => d.id === id);
    if (!doc) throw new Error("no document " + id + " in bench/key.json");
    const raw = fs.readFileSync(path.join(__dirname, "..", doc.file));
    const blocks = await B.blocksOf(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    const text = blocks.map((b) => b.text).join("\n");
    const rawToday = [], rawMine = [];
    await B.modelSuggest(today, blocks, rawToday);
    await B.modelSuggest(mine, blocks, rawMine);
    const r = await predict(mine, spec, text);
    const c1 = compare(r.raw, mapped(rawMine)), c2 = compare(mapped(rawMine), mapped(rawToday));
    // pieces by index: the first chunk's tokens against the tokenizer's own pieces
    const { t } = E.nerChunks(text)[0];
    const res = await mine(t, { ignore_labels: [] });
    const pieces = mine.tokenizer.tokenize(t, { add_special_tokens: true });
    const off = res.filter((x) => pieces[x.index] !== x.word).length;
    const h = r.health;
    console.log(`${id}: predict vs loader ${c1.same}/${c1.a}/${c1.b} ${c1.equal ? "equal" : "DIFFER"} (max score diff ${c1.scoreDiff.toExponential(1)}); ` +
      `loader vs today ${c2.same}/${c2.a}/${c2.b} ${c2.equal ? "equal" : "DIFFER"} (max score diff ${c2.scoreDiff.toExponential(1)}); ` +
      `pieces off-index ${off}/${res.length}; health unmapped ${h.unmappedLabels}, over510 ${h.chunksOver510}, errors ${h.chunkErrors}, alignFail ${h.alignFailTokens}/${h.tokens}`);
    if (!c1.equal || !c2.equal || c1.scoreDiff > 1e-6 || off || h.unmappedLabels || h.chunksOver510 || h.chunkErrors) ok = false;
  }
  console.log(ok ? "parity: pass" : "parity: FAIL");
  if (!ok) process.exitCode = 1;
})().catch((e) => { console.error(e && e.stack || e); process.exitCode = 1; });
