/* One model over one gold set -> predictions files (FORMATS.md "Predictions").

     node bench/model-eval/run.js --model <key> --set <gold.json> [--out <dir>]
          [--chunk N] [--min 0.6] [--tok product|faithful] [--private] [--offline]

   Writes <out>/<key>[.c<N>].<set>.raw.json (threshold 0, every span with its score) and
   <out>/<key>[.c<N>].<set>.cleaned.json (nerClean at --min, the product's 0.6 by default).
   --chunk: nerChunks' limit, for the chunk-size rows; the files then carry "chunk": N.
   --tok faithful: the tokenizer as the model was trained (tokfix.js, RESULTS.md); the run is
   named <key>-ft, so it sits beside the product run in every table.

   --private (her documents, PLAN.md section 6):
     - the output must be under private-bench/model-eval/ (the default there), nowhere else;
     - no network: every model file must already be cached;
     - the console gets numbers and allowlisted words only, through privacy.js, and any
       error is stripped of its message before it is printed.
   A set that lives under private-bench/ is refused without --private.

   Never writes bench/results* or private-bench/results*.json. */
const fs = require("fs");
const path = require("path");
const { loadModel, getSpec, ROOT } = require("./load.js");
const { predict, cleaned } = require("./predict.js");

const PRIVATE_ROOT = path.join(ROOT, "private-bench");
const PRIVATE_OUT = path.join(PRIVATE_ROOT, "model-eval");
let privacy = null;
try { privacy = require("./privacy.js"); } catch (_) { /* not built yet: private runs print counts only */ }

function parseArgs(argv) {
  const a = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) throw usage("unexpected argument #" + (i + 1));
    if (m[1] === "private" || m[1] === "offline") { a.flags.add(m[1]); continue; }
    // a misspelt --out must not quietly fall back to the default folder
    if (!OPTIONS.has(m[1])) throw usage("unknown option #" + (i + 1));
    const v = m[2] !== undefined ? m[2] : argv[++i];
    if (v === undefined || (m[2] === undefined && /^--/.test(v))) throw usage("option #" + (i + 1) + " needs a value");
    a[m[1]] = v;
  }
  return a;
}
const OPTIONS = new Set(["model", "set", "out", "chunk", "min", "tok"]);
// argument errors, raised before any document is read: safe to print as they are
const usage = (m) => Object.assign(new Error(m), { usage: true });
const inside = (p, dir) => { const r = path.relative(dir, p); return r === "" || (!!r && !r.startsWith("..") && !path.isAbsolute(r)); };
const HEALTH_KEYS = ["unmappedLabels", "chunksOver510", "chunkErrors", "alignFailTokens", "alignFailEntityTokens", "entityTokens", "tokens"];

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const priv = a.flags.has("private");
  // private output: allowlisted numbers only; without privacy.js, the bare numbers of a line
  const log = !priv ? console.log : privacy ? privacy.safeLog
    : (...x) => console.log(x.filter((v) => typeof v === "number").join(" "));
  if (!a.model || !a.set) throw usage("usage: run.js --model <key> --set <gold.json> [--out <dir>] [--chunk N] [--min X] [--private]");
  const setFile = path.resolve(a.set);
  if (!priv && inside(setFile, PRIVATE_ROOT)) throw usage("a set under private-bench/ runs only with --private");
  const out = path.resolve(a.out || (priv ? path.join(PRIVATE_OUT, "pred") : path.join(__dirname, "out", "pred")));
  if (priv && !inside(out, PRIVATE_OUT)) throw usage("--private writes only under private-bench/model-eval/");
  const chunk = a.chunk != null ? Number(a.chunk) : null;
  if (chunk != null && !(Number.isInteger(chunk) && chunk >= 50)) throw usage("--chunk must be a whole number of characters, at least 50");
  const min = a.min != null ? Number(a.min) : 0.6;
  if (!(min >= 0 && min <= 1)) throw usage("--min must be between 0 and 1");
  const tok = a.tok || "product";
  if (!["product", "faithful"].includes(tok)) throw usage("--tok must be product or faithful");

  const spec = getSpec(a.model);
  const set = JSON.parse(fs.readFileSync(setFile, "utf8"));
  const setName = set.name || path.basename(setFile, ".json");

  const t0 = Date.now();
  const pipe = await loadModel(spec, { offline: priv || a.flags.has("offline"), tok });
  const name = spec.key + (tok === "faithful" ? "-ft" : "");
  const loadMs = Date.now() - t0;

  const health = Object.fromEntries(HEALTH_KEYS.map((k) => [k, 0]));
  const timing = { loadMs, scanMs: 0, words: 0 };
  const unmapped = new Set();
  const rawDocs = [], cleanDocs = [];
  for (const doc of set.docs) {
    const r = await predict(pipe, spec, doc.text, { chunk, gold: doc.mentions || [] });
    for (const k of HEALTH_KEYS) health[k] += r.health[k];
    timing.scanMs += r.timing.scanMs; timing.words += r.timing.words;
    for (const n of r.unmappedNames) unmapped.add(n);
    rawDocs.push({ id: doc.id, spans: r.raw });
    cleanDocs.push({ id: doc.id, spans: cleaned(doc.text, r.raw, { min }) });
  }

  const head = (stage, threshold) => Object.assign({ model: name, set: setName, stage, threshold }, chunk ? { chunk } : {}, tok !== "product" ? { tok } : {});
  const files = [
    [Object.assign(head("raw", 0), { docs: rawDocs, health, timing }), "raw"],
    [Object.assign(head("cleaned", min), { docs: cleanDocs, health, timing }), "cleaned"],
  ];
  fs.mkdirSync(out, { recursive: true });
  const base = name + (chunk ? ".c" + chunk : "") + "." + setName.replace(/[^\w.-]+/g, "_");
  for (const [obj, stage] of files) fs.writeFileSync(path.join(out, base + "." + stage + ".json"), JSON.stringify(obj, null, 1) + "\n", "utf8");

  const nRaw = rawDocs.reduce((n, d) => n + d.spans.length, 0), nClean = cleanDocs.reduce((n, d) => n + d.spans.length, 0);
  log("model", name, "docs", set.docs.length, "raw", nRaw, "cleaned", nClean);
  log("health", health);
  // seconds in a private run: the gate refuses 7-digit integers (ID shapes), a long scan in ms is one
  if (priv) log("sec", "load", +(timing.loadMs / 1000).toFixed(1), "scan", +(timing.scanMs / 1000).toFixed(1), "words", timing.words);
  else log("timing", timing);
  if (!priv) {
    if (unmapped.size) console.log("unmapped labels (add them to labelMap, null to drop): " + [...unmapped].join(", "));
    console.log("wrote " + path.join(out, base) + ".{raw,cleaned}.json");
  }
  const bad = health.unmappedLabels || health.chunksOver510 || health.chunkErrors;
  if (bad) { log("health", "fail"); process.exitCode = 2; }
}

if (require.main === module) {
  const priv = process.argv.includes("--private");
  Promise.resolve().then(main).catch((err) => {
    // a usage error is this file's own fixed text; anything else in a private run can carry
    // a chunk of her text, so only its class and frames are printed
    if (err && err.usage) console.error(err.message);
    else if (priv) console.error(privacy ? privacy.sanitise(err).stack : "run failed (message withheld)");
    else console.error(err && err.stack || err);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, inside, PRIVATE_OUT };
