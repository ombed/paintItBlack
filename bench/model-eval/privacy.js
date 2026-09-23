/* The privacy gate for model-eval runs that touch her documents (PLAN.md section 6).

   Everything a private run prints, and everything it writes outside private-bench/, goes
   through here. The rule is an allowlist, not a blocklist: a token passes only if it is a
   number, a fixed label or model key, a category id, a fixture folder name, a metric or
   field name from a fixed list, or structural punctuation for Markdown tables and JSON.
   Anything else is refused whatever its script, because a blocklist only catches the
   shapes someone thought of in advance.

   A refusal never quotes what it refused: the error says which class of thing it was
   (hebrew, word, id-or-phone, email, url, path...) and where (argument or field number),
   so the error itself cannot carry the text out.

   Exports:
     allow(value)        -> value, or throws PrivacyError
     safeLog(...args)    console output for private runs
     safeWrite(path, x)  JSON (objects) or Markdown (strings); atomic, nothing written on refusal
     wrapErrors(fn)      runs fn (sync or async); rethrows errors with message and text stripped */
const fs = require("fs");
const path = require("path");

class PrivacyError extends Error {
  constructor(reason, where) {
    super(`privacy: refused ${reason}${where ? " in " + where : ""}`);
    this.name = "PrivacyError";
    this.reason = reason;
  }
}

/* ── the fixed lists ── */

// Entity types, the raw type names models emit (so health reports can name an unmapped one),
// label schemes, and a few table words. Upper case; B-/I-/E-/S-/L-/U- prefixed forms pass too.
const LABELS = new Set([
  "PER", "ORG", "PLACE", "O", "GPE", "LOC", "FAC", "MISC", "EVE", "WOA", "ANG", "DUC",
  "TIMEX", "TTL", "DATE", "TIME", "MONEY", "PERCENT", "LANGUAGE", "NORP", "PERS", "PII",
  "BIO", "BIOES", "IO", "IOB1", "B_only", "ALL", "TOTAL", "NONE", "OTHER", "UNTYPED",
]);

// Model keys from PLAN.md sections 2.1 and 2.3; the registry files add to these at load.
const PLAN_KEYS = [
  "base-q8", "base-fp32", "base-uint8", "base-fp16", "base-q4f16", "large-q8", "large-fp16",
  "large-parse", "joint-base", "tiny-joint", "parse-base", "tiny-parse", "iahlt-base",
  "msperka-dicta", "hebert", "aleph", "golem", "abg", "hero", "xlmr-40", "xlmr-conll",
  "gliner-multi", "gliner-x-small", "privacy-filter", "stanza", "no-model",
];

// Metric names, the field names of FORMATS.md, set names and the few harness words a log
// line needs. Matched exactly, or with the first letter capitalised (table headers).
const WORDS = new Set([
  // metrics
  "tp", "fp", "fn", "tn", "p", "r", "f1", "f2", "f05", "found", "missed", "leaked", "junk",
  "precision", "recall", "support", "n", "count", "total", "sum", "mean", "median", "min",
  "max", "sd", "ci", "ci95", "lo", "hi", "delta", "diff", "gain", "loss", "rate", "ratio",
  "pct", "added", "lost", "kept", "new", "fixed", "broken", "same", "better", "worse", "gone", "scored",
  // fields (FORMATS.md)
  "name", "source", "licence", "split", "docs", "doc", "id", "genre", "text", "mentions",
  "s", "e", "type", "must", "cat", "ent", "contamination", "key", "repo", "revision", "dtype",
  "file", "sha256", "bytes", "localPath", "labelScheme", "labelMap", "tokenizer", "shippable",
  "tier", "trainedOn", "notes", "model", "set", "stage", "threshold", "spans", "score",
  "health", "unmappedLabels", "chunksOver510", "chunkErrors", "alignFailTokens",
  "alignFailEntityTokens", "entityTokens", "tokens", "timing", "loadMs", "scanMs", "words", "match", "micro",
  "macro", "perType", "perCat", "perDoc", "perFixture", "fixture", "fixtures", "baseline",
  "candidate", "raw", "cleaned", "word-exact", "overlap-typed", "overlap-untyped",
  "wordpiece", "bpe", "sentencepiece", "hub", "local",
  // sets
  "synthetic", "synthetic-tune", "synthetic-test", "protocol", "nemo", "nemo-test",
  "nemo-dev", "bmc", "bmc-1", "knesset", "knesset-ud", "ud", "private", "public",
  "known-cases", "tune", "test", "dev", "train",
  // harness words for log lines
  "run", "runs", "row", "rows", "models", "sets", "types", "cats", "label", "labels",
  "chunk", "chunks", "ms", "sec", "mb", "kb", "of", "and", "or", "vs", "per", "at", "by",
  "no", "yes", "ok", "pass", "fail", "passed", "failed", "error", "errors", "warn",
  "skip", "skipped", "done", "start", "load", "loaded", "scan", "rule", "gate", "parity",
  "noise", "band", "speed", "time", "true", "false", "null", "unknown",
]);

// Fields whose numbers are counts or timings the harness computes, never text it read: a
// whole number of a million or more is allowed only under these names (a long scan in ms).
const BIG_FIELDS = new Set(["loadMs", "scanMs", "words", "tokens", "bytes"]);

// one letter, then the name: every category in bench/key.json and in the private keys has this shape.
// A looser pattern let "COHEN_DANA" through (reviewer's finding).
const CATEGORY = /^[A-Z]_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;               // P_ARABIC, S_ALT, I_ID
// the shape, and then the actual folder list: "r1-dana-2026-01-01" has the shape of a fixture name
const FIXTURE_SHAPE = /^r[0-9]+-[a-z]+-\d{4}-\d{2}-\d{2}$/;       // r3-interview-2026-09-16
let fixtureNames = null;
const FIXTURE = { test: (t) => {
  if (!FIXTURE_SHAPE.test(t)) return false;
  if (!fixtureNames) {
    try { fixtureNames = new Set(fs.readdirSync(path.join(__dirname, "..", "..", "..", "private-bench")).filter((d) => FIXTURE_SHAPE.test(d))); }
    catch (_) { fixtureNames = new Set(); }
  }
  return fixtureNames.has(t);
} };
const PREFIXED = /^[BIESLU]-([A-Z]+)$/;                           // B-PER, I-GPE
const HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;                   // pinned revision, sha256
const RULE = /^[-=_.]+$/;                                         // --- in a table, ... in a log
const NUMBER = /^[+-]?(\d+)(\.\d+)?(?:e[+-]?\d+)?%?$/i;
const KEY_SHAPE = /^[a-z][a-z0-9.]*(?:-[a-z0-9.]+)*$/;
// Digit groups joined by horizontal space or any dash (NBSP and en dashes come out of Word).
const GROUPS = /\d+(?:(?:[^\S\r\n]+|[^\S\r\n]*[-‐‑‒–—][^\S\r\n]*)\d+)+/g;

// Characters a report may contain at all. Anything outside (Hebrew, Arabic, Cyrillic, @, /,
// \, emoji...) refuses the whole string before it is tokenised.
const CHARS = /^[A-Za-z0-9\s|\-:,.{}\[\]"'()%+=#*_<>~`!?;±≤≥×–—·✓✗→]*$/;
const SEP = /[\s|:,{}\[\]"'()+=#*<>~`!?;±≤≥×–—·✓✗→]+/;

let modelKeys = null, knownHashes = null;
function keys() {
  if (modelKeys) return modelKeys;
  modelKeys = new Set(PLAN_KEYS);
  knownHashes = new Set();
  for (const f of ["registry.json", "registry.exports.json"]) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(__dirname, f), "utf8")); } catch (_) { continue; }
    const rows = Array.isArray(j) ? j : j && typeof j === "object" ? Object.entries(j).map(([k, v]) => ({ key: k, ...(v && typeof v === "object" ? v : {}) })) : [];
    // A registry file is data too: only keys shaped like model keys join the list.
    for (const row of rows) {
      if (!row) continue;
      if (typeof row.key === "string" && KEY_SHAPE.test(row.key)) modelKeys.add(row.key);
      for (const h of [row.revision, row.sha256]) if (typeof h === "string" && HASH.test(h)) knownHashes.add(h);
    }
  }
  for (const k of [...modelKeys]) if (!k.startsWith("union-")) modelKeys.add("union-" + k);
  return modelKeys;
}
// Only the registry's own revisions and sha256s: any other hash could be one of her text
// (a 9-digit ID hashes to something a laptop can reverse in minutes).
function hashes() { keys(); return knownHashes; }

// An ID or a phone written in parts (123 456 789, 1234 5678 9, 050 123 4567), each part of
// which would pass alone. One-digit groups break a run, so a list of small counts (262 6 7 4 31)
// passes; a run of 2+-digit groups with 8 or more digits in all does not.
function groupedDigits(s) {
  for (const run of s.match(GROUPS) || []) {
    let n = 0;
    for (const g of run.split(/\D+/)) {
      if (g.length < 2) { n = 0; continue; }
      if ((n += g.length) >= 8) return "id-or-phone";
    }
  }
  return "";
}

/* ── checks; each returns a reason string, or "" when the thing passes ── */

function checkNumber(v, field) {
  if (!Number.isFinite(v)) return "non-finite-number";
  // 7+ digit integers are ID and phone shapes; outside BIG_FIELDS a count or timing that
  // large is reported in coarser units instead.
  if (Number.isInteger(v) && Math.abs(v) >= 1e6 && !BIG_FIELDS.has(field)) return "id-or-phone";
  return "";
}

function checkToken(t) {
  const lc = t.charAt(0).toLowerCase() + t.slice(1);
  if (WORDS.has(t) || WORDS.has(lc) || LABELS.has(t) || keys().has(t)) return "";
  if (CATEGORY.test(t) || FIXTURE.test(t) || RULE.test(t)) return "";
  const pre = PREFIXED.exec(t);
  if (pre && LABELS.has(pre[1])) return "";
  if (HASH.test(t) && /[a-f]/.test(t)) return hashes().has(t) ? "" : "hash";
  const m = NUMBER.exec(t);
  if (m) {
    // A leading zero (050, 03) never comes out of a number formatter; it is a phone or ID.
    if (m[1].length > 1 && m[1][0] === "0") return "id-or-phone";
    // 7+ whole digits, with or without a fraction (123456789.5 still carries the ID).
    if (m[1].length >= 7) return "id-or-phone";
    return "";
  }
  if (/\d/.test(t) && /^[\d.\-]+$/.test(t)) return "id-or-phone";
  return "word";
}

function checkText(s) {
  if (s === "") return "";
  if (!CHARS.test(s)) {
    if (/[֐-׿יִ-ﭏ]/.test(s)) return "hebrew";
    if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s)) return "email";
    if (/[a-z][a-z0-9+.-]*:\/\/|www\./i.test(s)) return "url";
    // Ratios like 262/6/7/4/31 are the one allowed use of a slash.
    const rest = s.replace(/(\d)\/(?=\d)/g, "$1 ");
    if (/[\/\\]/.test(rest)) return "path";
    if (CHARS.test(rest)) return checkText(rest);
    return "character";
  }
  if (/[a-z][a-z0-9+.-]*:\/\/|www\./i.test(s)) return "url";
  if (/\+\s?972|(?:^|[^\d.])972[\s.-]\d/.test(s)) return "id-or-phone";
  // Digit groups (see groupedDigits). A fixture name's date is the one such group allowed.
  const bare = s.replace(/(^|[^\w-])r[0-9]+-[a-z]+-\d{4}-\d{2}-\d{2}(?![\w-])/g, "$1|");
  if (groupedDigits(bare)) return "id-or-phone";
  for (let t of s.split(SEP)) {
    t = t.replace(/^\.+(?=\D)|\.+$/g, "");   // sentence dots, not decimal points
    if (!t) continue;
    const r = checkToken(t);
    if (r) return r;
  }
  return "";
}

function check(v, where, seen, field) {
  if (v === null || v === undefined || typeof v === "boolean") return;
  if (typeof v === "number") { const r = checkNumber(v, field); if (r) throw new PrivacyError(r, where); return; }
  if (typeof v === "string") { const r = checkText(v); if (r) throw new PrivacyError(r, where); return; }
  if (typeof v !== "object" || v instanceof Date || Buffer.isBuffer(v) || ArrayBuffer.isView(v))
    throw new PrivacyError("type " + (v instanceof Date ? "date" : ArrayBuffer.isView(v) ? "bytes" : typeof v), where);
  // Plain objects and arrays only. Anything else prints differently from what its entries show:
  // a boxed String("123456789") walks as single digits, a URL or a class with toJSON walks as
  // {} and serialises as its text, a Map as {}.
  const proto = Object.getPrototypeOf(v);
  if (!(Array.isArray(v) ? proto === Array.prototype : proto === Object.prototype || proto === null))
    throw new PrivacyError("type object", where);
  if (seen.has(v)) throw new PrivacyError("cycle", where);
  seen.add(v);
  let i = 0;
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
    if (!d.enumerable) continue;
    const index = Array.isArray(v) && /^\d+$/.test(k);
    // Positions, not names: the field name might itself be what was refused.
    const at = index ? `${where || "value"}[${k}]` : `${where || "value"} field #${i++}`;
    // A getter can answer the check one thing and the writer another.
    if (!("value" in d)) throw new PrivacyError("type accessor", at);
    if (!index) { const r = checkText(k); if (r) throw new PrivacyError(r, at + " (name)"); }
    check(d.value, at, seen, index ? field : k);
  }
  seen.delete(v);
}

function allow(value) {
  check(value, "", new Set());
  return value;
}

// What gets printed or written is the JSON of the value; check a copy parsed back from that
// very JSON too, so nothing (a toJSON, a proxy) can serialise differently from what was checked.
function frozen(v, where) {
  check(v, where, new Set());
  if (v === null || typeof v !== "object") return v;
  const copy = JSON.parse(JSON.stringify(v));
  check(copy, where, new Set());
  return copy;
}

function safeLog(...args) {
  const parts = args.map((a, i) => frozen(a, `argument #${i + 1}`));
  const line = parts.map((a) => (a && typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  // Arguments are joined with spaces: 123, 456, 789 each pass, "123 456 789" must not.
  const r = groupedDigits(line.replace(/(^|[^\w-])r[0-9]+-[a-z]+-\d{4}-\d{2}-\d{2}(?![\w-])/g, "$1|"));
  if (r) throw new PrivacyError(r, "the joined line");
  console.log(line);
}

function safeWrite(file, obj) {
  // Check the whole content before touching the disk, then write a temp file and rename it,
  // so a refusal or a crash never leaves a half-written report behind.
  if (typeof obj !== "string" && !(obj && typeof obj === "object"))
    throw new TypeError("safeWrite takes a Markdown string or a JSON object");
  let body;
  if (typeof obj === "string") { check(obj, "content", new Set()); body = obj; }
  else body = JSON.stringify(frozen(obj, "content"), null, 1) + "\n";
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, body, "utf8");
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) { /* never written */ }
    throw err;
  }
  return target;
}

/* ── errors ── */

// transformers.js and onnxruntime put input text in messages (a token, a chunk), and a stack
// repeats the message on its first line. Keep only the error class, a Node error code, and
// the stack's file:line frames whose file path is plain ASCII.
function sanitise(err) {
  if (err instanceof PrivacyError) return err;   // already text-free, and its reason helps
  let cls = "NonError";
  if (err instanceof Error) {
    const n = err.constructor && err.constructor.name;
    cls = /^[A-Za-z][A-Za-z0-9]{0,40}$/.test(n) ? n : "Error";
  }
  const code = err && typeof err.code === "string" && /^[A-Z][A-Z0-9_]{0,40}$/.test(err.code) ? err.code : "";
  const frames = [];
  let stack = err && typeof err.stack === "string" ? err.stack : "";
  // Cut the message off the top first: a message with newlines could hold lines shaped like frames.
  const head = err instanceof Error ? `${err.name}: ${err.message}` : "";
  if (head && stack.startsWith(head)) stack = stack.slice(head.length);
  else if (err instanceof Error && err.message && stack.includes(err.message)) stack = stack.slice(stack.indexOf(err.message) + err.message.length);
  for (const line of stack.split("\n")) {
    // file:/// frames are ES modules (transformers.js is one).
    const m = /^\s+at (?:.*?\()?((?:file:\/\/\/)?(?:[A-Za-z]:|node:)?[\w.\/\\@+~-]+):(\d+):\d+\)?\s*$/.exec(line);
    if (m) frames.push(`${m[1]}:${m[2]}`);
  }
  const out = new Error(`${cls}${code ? " " + code : ""} (message withheld by privacy gate)`);
  out.name = cls;
  if (code) out.code = code;
  out.sanitised = true;
  out.stack = `${cls}${code ? " " + code : ""}: message withheld by privacy gate\n` + frames.map((f) => "    at " + f).join("\n");
  return out;
}

function wrapErrors(fn) {
  let r;
  try { r = fn(); } catch (err) { throw sanitise(err); }
  if (r && typeof r.then === "function") return Promise.resolve(r).catch((err) => { throw sanitise(err); });
  return r;
}

// the fixture list is read from private-bench; a test, or CI where the folder does not exist, sets it
function setFixtureNames(names) { fixtureNames = new Set((names || []).filter((d) => FIXTURE_SHAPE.test(d))); }
module.exports = { allow, safeLog, safeWrite, wrapErrors, PrivacyError, sanitise, LABELS, WORDS, setFixtureNames };
