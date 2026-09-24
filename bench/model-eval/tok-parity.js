/* Tokenizer parity (PLAN.md 3.1): for each model, transformers.js must give the same token ids
   as Python's HF tokenizer on 50 fixed sentences (gold/tok-sentences.json, all invented).

     node bench/model-eval/tok-parity.js [key ...]     default: every registry row with a
                                                        distinct tokenizer folder on disk

   The reference is transformers' AutoTokenizer in Python, which ignores the fixed padding that
   iahlt's and golem's tokenizer.json ask for (EXPORTS.md 4), as transformers.js does.
   transformers.js is read three ways, each in its own Node process so one cannot leak into another:
     wrapper  bench/engine.js loaded: the engine's RegExp wrapper rewrites a pattern that does
              not compile (the harness path, bench/model-eval/load.js)
     fixed    no wrapper; tokenizer.json passed through the page's fixTokJSON first (the
              browser path: its fetch hook fixes the file before transformers.js reads it)
     plain    neither: the file as published
   wrapper and fixed must match on all 50; plain is reported (DictaBERT's does not load at all).

   Prints and writes (out/tok-parity.json) sentence numbers and token ids only. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { faithfulTokJSON, TOK_FILES } = require("./tokfix.js");

const SENTENCES = JSON.parse(fs.readFileSync(path.join(__dirname, "gold", "tok-sentences.json"), "utf8")).sentences;

// the Python reference: AutoTokenizer from the folder, special tokens included
const PY = `
import json, sys
from transformers import AutoTokenizer
# bytes, decoded as UTF-8: on Windows sys.stdin uses the ANSI code page and garbles Hebrew
req = json.loads(sys.stdin.buffer.read().decode("utf-8"))
out = {}
for key, d in req["dirs"].items():
    try:
        tok = AutoTokenizer.from_pretrained(d, local_files_only=True)
        out[key] = [tok(s)["input_ids"] for s in req["sentences"]]
    except Exception as e:
        out[key] = {"error": type(e).__name__ + ": " + str(e)[:300]}
sys.stdout.write(json.dumps(out))
`;

// one Node process per way: reads {dirs, sentences, wrapper} on stdin, writes ids or an error per key
async function child() {
  const req = JSON.parse(fs.readFileSync(0, "utf8"));
  if (req.wrapper) require("../engine.js");
  const T = await import("@huggingface/transformers");
  T.env.allowLocalModels = true;
  T.env.allowRemoteModels = false;
  const out = {};
  for (const [key, d] of Object.entries(req.dirs)) {
    try {
      T.env.localModelPath = path.dirname(d);
      const tok = await T.AutoTokenizer.from_pretrained(path.basename(d), { local_files_only: true });
      out[key] = req.sentences.map((s) => Array.from(tok.encode(s), Number));
    } catch (e) {
      out[key] = { error: e && e.name ? e.name : "Error" };
    }
  }
  process.stdout.write(JSON.stringify(out));
}

function runChild(dirs, wrapper) {
  const r = spawnSync(process.execPath, [__filename, "--child"], { input: JSON.stringify({ dirs, sentences: SENTENCES, wrapper }),
    encoding: "utf8", maxBuffer: 256 << 20, timeout: 600000 });
  if (r.status !== 0) throw new Error("the " + (wrapper ? "wrapper" : "plain") + " run failed: " + String(r.stderr).split("\n").slice(-3).join(" "));
  return JSON.parse(r.stdout);
}

function runPython(dirs) {
  const env = Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: "1", HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" });
  const go = (cmd, pre) => spawnSync(cmd, [...pre, "-c", PY], { input: JSON.stringify({ dirs, sentences: SENTENCES }), encoding: "utf8", maxBuffer: 256 << 20, timeout: 600000, env });
  let r = go("py", ["-3"]);
  if (r.error) r = go("python3", []);
  if (r.error || r.status !== 0) throw new Error("the Python reference failed: " + String(r.error || r.stderr).split("\n").slice(-3).join(" "));
  return JSON.parse(r.stdout);
}

// the tokenizer folder a registry row loads from: the onnx file's folder's parent
function tokDirs(keys) {
  const { readRegistry, modelFile } = require("./load.js");
  const rows = readRegistry().filter((s) => !keys.length || keys.includes(s.key));
  const dirs = {}, seen = new Map();
  for (const s of rows) {
    const d = path.dirname(path.dirname(modelFile(s)));
    if (!fs.existsSync(path.join(d, "tokenizer.json"))) continue;
    if (seen.has(d)) continue; // fp32 and q8 rows of one export share a tokenizer
    seen.set(d, s.key);
    dirs[s.key] = d;
  }
  return dirs;
}

// a copy of the tokenizer files with tokenizer.json rewritten: fixTokJSON is the browser's copy
function fixedCopies(dirs, transform) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tok-fixed-"));
  const out = {}, changed = {};
  for (const [key, d] of Object.entries(dirs)) {
    const to = path.join(tmp, key);
    fs.mkdirSync(to);
    for (const f of TOK_FILES) if (fs.existsSync(path.join(d, f))) fs.copyFileSync(path.join(d, f), path.join(to, f));
    const txt = fs.readFileSync(path.join(d, "tokenizer.json"), "utf8");
    const fixed = transform(txt);
    changed[key] = fixed !== txt;
    fs.writeFileSync(path.join(to, "tokenizer.json"), fixed);
    out[key] = to;
  }
  return { tmp, dirs: out, changed };
}


// per key: sentences equal to the reference, and the first one that differs
function agree(ref, got) {
  if (!Array.isArray(ref)) return { error: "reference " + ref.error };
  if (!Array.isArray(got)) return { error: got.error };
  const bad = [];
  ref.forEach((ids, i) => { if (JSON.stringify(ids) !== JSON.stringify(got[i])) bad.push(i + 1); });
  const first = bad.length ? bad[0] - 1 : -1;
  return { equal: ref.length - bad.length, of: ref.length, differ: bad,
    first: first < 0 ? null : { sentence: first + 1, reference: ref[first], got: got[first] } };
}

async function main(keys) {
  const E = require("../engine.js"); // for fixTokJSON; this parent process never loads a tokenizer
  const dirs = tokDirs(keys);
  if (!Object.keys(dirs).length) throw new Error("no tokenizer folders found on disk");
  const ref = runPython(dirs);
  const wrapper = runChild(dirs, true);
  const plain = runChild(dirs, false);
  const mute = (f) => (txt) => { const log = console.log; console.log = () => {}; try { return f(txt); } finally { console.log = log; } };
  const F = fixedCopies(dirs, mute((t) => E.fixTokJSON(t)));
  const G = fixedCopies(dirs, (t) => faithfulTokJSON(t, E));
  let fixed, faithful;
  try { fixed = runChild(F.dirs, false); faithful = runChild(G.dirs, false); }
  finally { for (const x of [F, G]) fs.rmSync(x.tmp, { recursive: true, force: true }); }

  const rows = Object.keys(dirs).map((key) => ({ key, fixTokJSONChanged: F.changed[key],
    wrapper: agree(ref[key], wrapper[key]), fixed: agree(ref[key], fixed[key]), plain: agree(ref[key], plain[key]),
    faithful: agree(ref[key], faithful[key]) }));
  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "tok-parity.json"), JSON.stringify({ sentences: SENTENCES.length, rows }, null, 1) + "\n");

  // counts here; which sentences differ is in the JSON
  const cell = (a) => (a.error ? "no load (" + a.error.split(":")[0] + ")" : `${a.equal}/${a.of}`);
  let failed = 0;
  console.log(`tokenizer parity, ${SENTENCES.length} sentences, against Python AutoTokenizer`);
  console.log("  " + ["", "model", "wrapper", "fixed", "plain", "faithful"].map((x, i) => x.padEnd([4, 14, 8, 8, 18, 8][i])).join(" "));
  for (const r of rows) {
    const pass = !r.wrapper.error && !r.fixed.error && !r.wrapper.differ.length && !r.fixed.differ.length;
    if (!pass) failed++;
    console.log("  " + [pass ? "ok" : "FAIL", r.key, cell(r.wrapper), cell(r.fixed), cell(r.plain), cell(r.faithful)]
      .map((x, i) => x.padEnd([4, 14, 8, 8, 18, 8][i])).join(" ") + (r.fixTokJSONChanged ? " (fixTokJSON rewrote a pattern)" : ""));
  }
  console.log(failed ? `${failed} tokenizer(s) differ: details in bench/model-eval/out/tok-parity.json` : "every tokenizer matches on the harness and browser paths");
  if (failed) process.exitCode = 1;
}

module.exports = { agree, tokDirs };
if (require.main === module) {
  const run = process.argv.includes("--child") ? child() : main(process.argv.slice(2).filter((a) => !a.startsWith("--")));
  run.catch((e) => { console.error(e && e.stack || e); process.exitCode = 1; });
}
