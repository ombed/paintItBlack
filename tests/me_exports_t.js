/* The model exports' registry entries (bench/model-eval/registry.exports.json), checked
   against docs/model-eval/FORMATS.md. The loader refuses a file whose sha256 differs, and the
   adapters treat an unmapped label as a harness error, so a malformed entry here would only
   show up hours later as a failed run. Offline and fast: it reads the JSON only.

   ME_EXPORT_FILES=1 also hashes each exported file under model-cache/ (a few seconds per
   file), to confirm the registry still describes what is on disk. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { spawnSync } = require("child_process");

const REG = path.join(__dirname, "..", "bench", "model-eval", "registry.exports.json");
const ORDER = ["key", "repo", "revision", "dtype", "file", "sha256", "bytes", "source", "localPath", "labelScheme", "labelMap",
  "tokenizer", "licence", "shippable", "tier", "trainedOn", "notes"];
const SCHEMES = new Set(["BIO", "BIOES", "IO", "B_only", "IOB1"]);
const KINDS = new Set(["PER", "ORG", "PLACE", null]);
const SHIPPABLE = new Set(["CC-BY-4.0", "Apache-2.0", "MIT"]);
const FILE_OF = { q8: "onnx/model_quantized.onnx", fp32: "onnx/model.onnx" };
// every tier-1 export the plan names (section 2); a missing one must be explained in EXPORTS.md
const PLANNED = ["joint-base", "parse-base", "tiny-parse", "iahlt-base", "msperka-dicta", "aleph", "golem", "large-q8"];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the entry checks, as a function so the invented bad entries below can prove each one bites
function problems(e) {
  const out = [];
  const keys = Object.keys(e);
  if (keys.join() !== ORDER.join()) out.push("fields");
  if (!/^[0-9a-f]{40}$/.test(e.revision)) out.push("revision");
  if (!/^[0-9a-f]{64}$/.test(e.sha256)) out.push("sha256");
  if (!(Number.isInteger(e.bytes) && e.bytes > 1e6)) out.push("bytes");
  if (e.source !== "local") out.push("source");
  // a folder name under model-cache (the loader resolves it there): no drive, no slash, no user's home in the repo
  if (!(typeof e.localPath === "string" && /^[a-z0-9][a-z0-9.-]*$/.test(e.localPath))) out.push("localPath");
  if (FILE_OF[e.dtype] !== e.file) out.push("file");
  if (!SCHEMES.has(e.labelScheme)) out.push("labelScheme");
  const vals = Object.values(e.labelMap || {});
  if (!vals.length || !vals.every((v) => KINDS.has(v))) out.push("labelMap");
  if (!vals.includes("PER")) out.push("noPER");
  if (Object.keys(e.labelMap || {}).some((t) => /^[BIES][-_]/.test(t) || t === "O")) out.push("prefixInMap");
  if (!["wordpiece", "sentencepiece", "bpe"].includes(e.tokenizer)) out.push("tokenizer");
  if (e.shippable !== SHIPPABLE.has(e.licence)) out.push("shippable");
  if (!(Array.isArray(e.trainedOn) && e.trainedOn.length)) out.push("trainedOn");
  if (typeof e.notes !== "string") out.push("notes");
  // a name, body or place type mapped to null would be dropped without anyone noticing
  if (Object.entries(e.labelMap || {}).some(([t, v]) => v === null && NAMEISH.test(t))) out.push("nameDropped");
  return out;
}
const NAMEISH = /^(PERS?|PERSON|\w*NAME|ORG|GPE|LOC|FAC|CITY|STREET)$/i;

// the scheme a set of labels implies, written independently of export.py's label_scheme
function schemeOf(labels) {
  const pre = new Set(labels.filter((l) => l !== "O").map((l) => (/^[BIESLU][-_]/.test(l) ? l[0] : "")));
  const under = labels.some((l) => l !== "O" && l[1] === "_");
  if (under && [...pre].every((p) => p === "B")) return "B_only";
  if (pre.has("E") || pre.has("S")) return "BIOES";
  if (pre.size === 1 && (pre.has("I") || pre.has(""))) return "IO";
  if (pre.size === 2 && pre.has("B") && pre.has("I")) return "BIO";
  return "?";
}

// export.py's pure helpers, run in Python on invented labels and fake tensors (no torch import)
const PY_CHECKS = `
import json, sys
sys.path.insert(0, sys.argv[1])
import export as X
class T:
    def __init__(self, rows): self.ndim, self.shape = 2, (rows, 8)
def err(f, *a):
    try:
        f(*a); return None
    except (ValueError, SystemExit) as e:
        return type(e).__name__
golem = ["O", "B-FIRST_NAME", "I-FIRST_NAME", "B-LAST_NAME", "B-CITY", "B-STREET", "B-POSTAL_CODE", "B-EMAIL", "B-ID_NUM"]
out = {
 "split": [X.split_label(l) for l in ["B-PER", "B_PERS", "S-LOC", "PER", "O", "I-CC_NUM"]],
 "schemes": [X.label_scheme(ls) for ls in [["O", "B-PER", "I-PER"], ["O", "B-PER", "I-PER", "E-PER", "S-PER"],
     ["O", "PER", "ORG"], ["O", "I-PER", "I-ORG"], ["O", "B_PERS", "B_LOC"], ["O", "B-CC_NUM", "I-CC_NUM"]]],
 "bilou": err(X.label_scheme, ["O", "B-PER", "I-PER", "L-PER", "U-PER"]),
 "mixed": err(X.label_scheme, ["O", "PER", "B-ORG"]),
 "golemMap": X.label_map(golem),
 "unknownType": err(X.label_map, ["O", "B-PER", "B-NICKNAME"]),
 "nemoMap": X.label_map(["O", "S-PER", "B-ORG", "E-GPE", "I-WOA", "S-ANG"]),
 "head": X.head_prefix({"bert.x.weight": T(27), "classifier.weight": T(27), "classifier.bias": T(27),
     "syntax.w.weight": T(27), "cls.dense.weight": T(768)}, "joint-base", 27),
 "headNone": err(X.head_prefix, {"bert.x.weight": T(27), "syntax.w.weight": T(27)}, "joint-base", 27),
 "headTwo": err(X.head_prefix, {"classifier.a.weight": T(27), "classifier.b.weight": T(27)}, "joint-base", 27),
 "load": X.load_problems(["bert.embeddings.position_ids", "classifier.bias"], ["bert.pooler.dense.weight"]),
 "revisions": all(len(m["revision"]) == 40 and all(c in "0123456789abcdef" for c in m["revision"]) for m in X.MODELS.values()),
 "order": X.EXPORT_ORDER,
 "shippable": {k: m["licence"] in X.SHIPPABLE for k, m in X.MODELS.items()},
}
print(json.dumps(out))
`;

(async () => {
  console.log("\n— the checks catch what they are for (invented entries) —");
  const good = { key: "x", repo: "a/b", revision: "0".repeat(40), dtype: "q8", file: "onnx/model_quantized.onnx",
    sha256: "a".repeat(64), bytes: 5e6, source: "local", localPath: "x", labelScheme: "BIO",
    labelMap: { PER: "PER", ORG: "ORG", GPE: "PLACE", MISC: null }, tokenizer: "wordpiece", licence: "MIT",
    shippable: true, tier: 1, trainedOn: ["NEMO"], notes: "" };
  ok(problems(good).length === 0, "a well-formed entry passes: " + problems(good));
  const bad = (patch, want) => { const p = problems(Object.assign({}, good, patch)); ok(p.includes(want), `${want} is caught (${p})`); };
  bad({ revision: "main" }, "revision");
  bad({ sha256: "abc" }, "sha256");
  bad({ dtype: "fp32" }, "file");
  bad({ labelScheme: "BILOU" }, "labelScheme");
  bad({ labelMap: { PER: "PERSON" } }, "labelMap");
  bad({ labelMap: { ORG: "ORG" } }, "noPER");
  bad({ labelMap: { "B-PER": "PER" } }, "prefixInMap");
  bad({ licence: "CC-BY-NC-4.0" }, "shippable");
  bad({ licence: "Apache-2.0", shippable: false }, "shippable");
  bad({ localPath: "C:/p/repo-clone/bench/x" }, "localPath");
  bad({ localPath: "C:/Users/someone/model-cache/x" }, "localPath");
  bad({ localPath: "../x" }, "localPath");
  bad({ labelMap: { PER: "PER", FIRST_NAME: null } }, "nameDropped");
  bad({ labelMap: { PER: "PER", GPE: null } }, "nameDropped");
  ok(schemeOf(["O", "B-PER", "I-PER"]) === "BIO" && schemeOf(["O", "PER", "ORG"]) === "IO" &&
    schemeOf(["O", "S-PER", "B-PER", "E-PER", "I-PER"]) === "BIOES" && schemeOf(["O", "B_PERS"]) === "B_only" &&
    schemeOf(["O", "U-PER", "B-PER"]) === "?", "the test's own scheme reader");

  console.log("\n— export.py helpers (py -3, invented labels) —");
  // py -3 on Windows, python3 on the Linux runner: the check count is the same on both
  const runPy = (cmd, pre) => spawnSync(cmd, [...pre, "-", path.join(__dirname, "..", "bench", "model-eval")],
    // no __pycache__ left in bench/model-eval (it is not gitignored)
    { input: PY_CHECKS, encoding: "utf8", timeout: 60000, env: Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: "1" }) });
  let py = runPy("py", ["-3"]);
  if (py.error) py = runPy("python3", []);
  if (py.error || py.status !== 0) {
    // the exports need Python anyway; without it only the helper checks are skipped, and say so
    console.log("  (skipped: py -3 not runnable here: " + String(py.error || py.stderr).split("\n").slice(-2).join(" ") + ")");
  } else {
    const r = JSON.parse(py.stdout.trim().split("\n").pop());
    ok(JSON.stringify(r.split) === JSON.stringify([["B", "PER"], ["B", "PERS"], ["S", "LOC"], [null, "PER"], [null, null], ["I", "CC_NUM"]]),
      "split_label strips exactly one prefix and keeps underscores inside a type: " + JSON.stringify(r.split));
    ok(r.schemes.join() === "BIO,BIOES,IO,IO,B_only,BIO", "label_scheme: " + r.schemes);
    ok(r.bilou === "ValueError", "an unknown scheme (BILOU) stops the registry");
    ok(r.mixed === "ValueError", "bare and prefixed labels mixed stop the registry");
    ok(r.golemMap.FIRST_NAME === "PER" && r.golemMap.LAST_NAME === "PER" && r.golemMap.CITY === "PLACE" &&
      r.golemMap.STREET === "PLACE" && r.golemMap.POSTAL_CODE === "PLACE" && r.golemMap.EMAIL === null && r.golemMap.ID_NUM === null,
      "golem's types map as PLAN 5.3 says: " + JSON.stringify(r.golemMap));
    ok(r.unknownType === "ValueError", "a type in neither TO_KIND nor DROP stops the registry instead of becoming null");
    ok(JSON.stringify(r.nemoMap) === JSON.stringify({ ANG: null, GPE: "PLACE", ORG: "ORG", PER: "PER", WOA: null }),
      "BIOES labels collapse to one entry per type: " + JSON.stringify(r.nemoMap));
    ok(r.head === "classifier.", "head_prefix picks the named head, not another head of the same width");
    ok(r.headNone === "SystemExit" && r.headTwo === "SystemExit", "head_prefix refuses to guess with no or two candidates");
    ok(JSON.stringify(r.load) === JSON.stringify([["classifier.bias"], ["bert.pooler.dense.weight"]]),
      "load_problems ignores only position_ids: " + JSON.stringify(r.load));
    ok(r.revisions, "every MODELS revision is 40 hex");
    ok(JSON.stringify([...r.order].sort()) === JSON.stringify([...PLANNED].sort()), "EXPORT_ORDER is the plan's tier-1 list");
    ok(Object.values(r.shippable).every(Boolean), "every licence in MODELS is shippable (as the cards say)");
  }

  console.log("\n— registry.exports.json —");
  ok(fs.existsSync(REG), "registry.exports.json exists");
  if (!fs.existsSync(REG)) { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = 1; return; }
  const raw = fs.readFileSync(REG, "utf8");
  const reg = JSON.parse(raw);
  ok(Array.isArray(reg) && reg.length > 0, "an array of entries");
  ok(raw === JSON.stringify(reg, null, 1) + "\n", "pretty-printed with one-space indent");
  ok(new Set(reg.map((e) => e.key)).size === reg.length, "keys are unique");
  for (const e of reg) ok(problems(e).length === 0, `${e.key}: ${problems(e).join(", ")}`);
  // each q8 row has its fp32 reference, from the same export and the same revision
  for (const e of reg.filter((x) => x.dtype === "q8")) {
    const f = reg.find((x) => x.key === e.key + "-fp32");
    ok(f && f.revision === e.revision && f.localPath === e.localPath && f.bytes > e.bytes * 2, `${e.key} has its fp32 row`);
    // the two rows are one export read two ways: only the file differs
    const same = ["repo", "source", "labelScheme", "labelMap", "tokenizer", "licence", "shippable", "tier", "trainedOn"];
    ok(f && same.every((n) => JSON.stringify(f[n]) === JSON.stringify(e[n])) && f.sha256 !== e.sha256,
      `${e.key}: its fp32 row differs only in the file`);
  }
  ok(new Set(reg.map((e) => e.sha256)).size === reg.length, "no two entries claim the same file bytes");
  ok(!reg.some((e) => e.key.startsWith("recipe-base")), "the recipe-check export is not a candidate");
  const missing = PLANNED.filter((k) => !reg.some((e) => e.key === k));
  const doc = fs.readFileSync(path.join(__dirname, "..", "bench", "model-eval", "EXPORTS.md"), "utf8");
  // every key appears in EXPORTS.md's tables anyway; a missing one needs a line that says so
  for (const k of missing) ok(doc.split("\n").some((l) => l.includes("`" + k + "`") && /not exported|could not|cannot/i.test(l)),
    `${k} is not exported, and EXPORTS.md says why`);

  if (process.env.ME_EXPORT_FILES === "1") {
    console.log("\n— files on disk match the registry —");
    const { MODEL_CACHE } = require("../bench/model-eval/load.js");
    for (const e of reg) {
      const dir = path.join(MODEL_CACHE, e.localPath);
      const p = path.join(dir, e.file);
      if (!fs.existsSync(p)) { ok(false, `${e.key}: ${p} missing`); continue; }
      ok(fs.statSync(p).size === e.bytes, `${e.key}: size`);
      const h = crypto.createHash("sha256");
      for await (const b of fs.createReadStream(p)) h.update(b);
      ok(h.digest("hex") === e.sha256, `${e.key}: sha256`);
      for (const n of ["config.json", "tokenizer.json", "tokenizer_config.json"]) ok(fs.existsSync(path.join(dir, n)), `${e.key}: ${n}`);
      const cfg = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8"));
      const types = new Set(Object.values(cfg.id2label).filter((l) => l !== "O").map((l) => l.replace(/^[BIES][-_]/, "")));
      ok([...types].every((t) => t in e.labelMap), `${e.key}: every config label type is in labelMap`);
      ok(Object.keys(e.labelMap).every((t) => types.has(t)), `${e.key}: labelMap has no type the model cannot emit`);
      ok(schemeOf(Object.values(cfg.id2label)) === e.labelScheme, `${e.key}: labelScheme ${e.labelScheme} matches id2label`);
      // transformers.js must read a stock class from the config, never custom code
      ok(!cfg.auto_map && /^(Bert|XLMRoberta)ForTokenClassification$/.test((cfg.architectures || [])[0]), `${e.key}: stock architecture, no auto_map`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
