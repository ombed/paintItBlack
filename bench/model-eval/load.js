/* Loading a model for the harness, pinned and checked (PLAN.md 5.2, FORMATS.md).

   loadModel(spec, opt) -> the transformers.js token-classification pipeline
     spec: a registry key ("base-q8") or a registry entry
     opt.offline: no network at all (private runs); every file must already be cached

   - hub rows: the pinned 40-hex revision and dtype, each model in its own cache folder
     (model-cache/hf/<key>), so two rows of one repo never share or overwrite a file;
   - local rows (exports): read from model-cache/<key>/ through env.localModelPath, never
     from the network, even when the key happens to look like a hub id;
   - the onnx file's sha256 is computed on the file on disk and must equal the registry's,
     or loading stops. A file already on disk is checked before it is opened; a fresh
     download is checked before the pipeline is handed back;
   - bench/engine.js is loaded first: it installs the engine's RegExp wrapper, as the page
     does, and DictaBERT's tokenizer does not load without it.

   The registry is registry.json (hub rows, this part) plus registry.exports.json (the
   exports part), when present. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("../engine.js");

// paintItBlack/, beside the repository; model-cache/ and private-bench/ live there
const ROOT = path.resolve(__dirname, "..", "..", "..");
const MODEL_CACHE = process.env.PIB_MODEL_CACHE || path.join(ROOT, "model-cache");
const HF_CACHE = path.join(MODEL_CACHE, "hf");
const REGISTRY_FILES = ["registry.json", "registry.exports.json"];
const DTYPE_SUFFIX = { fp32: "", fp16: "_fp16", q8: "_quantized", int8: "_int8", uint8: "_uint8",
  q4: "_q4", bnb4: "_bnb4", q4f16: "_q4f16" };
const REQUIRED = ["key", "dtype", "file", "sha256", "source", "labelScheme", "labelMap", "tokenizer"];

function readRegistry(dir) {
  const rows = [];
  for (const f of REGISTRY_FILES) {
    const p = path.join(dir || __dirname, f);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!Array.isArray(j)) throw new Error(f + " must be an array of entries");
    for (const r of j) rows.push(Object.assign({ registryFile: f }, r));
  }
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.key)) throw new Error("registry: key " + r.key + " appears twice");
    seen.add(r.key);
  }
  return rows;
}

function getSpec(spec, dir) {
  if (spec && typeof spec === "object") return spec;
  const r = readRegistry(dir).find((x) => x.key === spec);
  if (!r) throw new Error("registry: no model " + spec);
  return r;
}

// the things a load depends on; a bad entry stops here, before any download
function validate(s) {
  for (const k of REQUIRED) if (s[k] == null) throw new Error("registry " + s.key + ": missing " + k);
  if (!/^[0-9a-f]{64}$/.test(s.sha256)) throw new Error("registry " + s.key + ": sha256 is not 64 hex");
  if (!(s.dtype in DTYPE_SUFFIX)) throw new Error("registry " + s.key + ": unknown dtype " + s.dtype);
  // transformers.js picks the file from the dtype; the registry must name that same file
  const want = "onnx/model" + DTYPE_SUFFIX[s.dtype] + ".onnx";
  if (s.file !== want) throw new Error("registry " + s.key + ": dtype " + s.dtype + " loads " + want + ", not " + s.file);
  if (s.source === "hub") {
    if (!s.repo) throw new Error("registry " + s.key + ": hub row without repo");
    if (!/^[0-9a-f]{40}$/.test(s.revision || "")) throw new Error("registry " + s.key + ": revision must be 40 hex");
  } else if (s.source !== "local") throw new Error("registry " + s.key + ": source must be hub or local");
  for (const [k, v] of Object.entries(s.labelMap)) {
    if (v !== null && !["PER", "ORG", "PLACE"].includes(v)) throw new Error("registry " + s.key + ": labelMap " + k + " -> " + v);
  }
}

// where a local export lives: localPath (absolute, or relative to model-cache) or model-cache/<key>
function localDir(s) {
  if (!s.localPath) return path.join(MODEL_CACHE, s.key);
  return path.isAbsolute(s.localPath) ? s.localPath : path.join(MODEL_CACHE, s.localPath);
}

// the onnx file on disk that the pipeline reads (transformers.js FileCache layout for hub rows)
function modelFile(spec) {
  const s = getSpec(spec);
  if (s.source === "local") return path.join(localDir(s), s.file);
  return path.join(HF_CACHE, s.key, s.repo, s.revision, s.file);
}

function sha256File(file) {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.allocUnsafe(8 << 20);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest("hex");
}

function checkFile(s, file) {
  const got = sha256File(file);
  if (got !== s.sha256) {
    throw new Error("sha256 mismatch for " + s.key + ": the file on disk is " + got + ", the registry says " + s.sha256 +
      ". Delete " + file + " or correct the registry; nothing was run.");
  }
  if (s.bytes != null && fs.statSync(file).size !== s.bytes) throw new Error("size mismatch for " + s.key + " (" + file + ")");
}

/* Copy a model file that is already on this machine into this row's cache folder, so a
   loader test does not download it again. Only a file with the registry's sha256 is taken. */
function seed(spec, from) {
  const s = getSpec(spec);
  const dest = modelFile(s);
  if (fs.existsSync(dest) || !from || !fs.existsSync(from)) return false;
  if (sha256File(from) !== s.sha256) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
  return true;
}

async function loadModel(spec, opt) {
  const s = getSpec(spec);
  validate(s);
  const o = opt || {};
  if (!globalThis.__nerRx) throw new Error("the engine's RegExp wrapper is not installed");
  const T = await import("@huggingface/transformers");
  const file = modelFile(s);
  const had = fs.existsSync(file);
  if (had) checkFile(s, file);
  let id, options = { dtype: s.dtype };
  if (s.source === "local") {
    if (!had) throw new Error("local model " + s.key + " not found at " + file);
    T.env.allowLocalModels = true;
    T.env.allowRemoteModels = false;
    T.env.localModelPath = path.dirname(localDir(s));
    id = path.basename(localDir(s));
    options.local_files_only = true;
  } else {
    // a folder under localModelPath must never stand in for a hub model. Offline, transformers.js
    // refuses to run with local and remote both off, so local stays on but points at a folder
    // that holds nothing: only the pinned cache can answer.
    T.env.allowLocalModels = !!o.offline;
    T.env.localModelPath = path.join(HF_CACHE, s.key, ".no-local-models");
    T.env.allowRemoteModels = !o.offline;
    id = s.repo;
    options.revision = s.revision;
    options.cache_dir = path.join(HF_CACHE, s.key);
  }
  const pipe = await T.pipeline("token-classification", id, options);
  if (!had) {
    if (!fs.existsSync(file)) throw new Error("model file for " + s.key + " is not where the cache should put it: " + file);
    checkFile(s, file);
  }
  return pipe;
}

module.exports = { loadModel, readRegistry, getSpec, validate, modelFile, sha256File, seed, MODEL_CACHE, HF_CACHE, ROOT, DTYPE_SUFFIX };
