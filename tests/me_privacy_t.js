/* The model-eval privacy gate (bench/model-eval/privacy.js, PLAN.md section 6).

   A private run prints and writes only what this gate lets through, so the gate is the one
   thing standing between her documents and a report that gets committed. Every example
   here is invented. */
const fs = require("fs"), os = require("os"), path = require("path");
const { allow, safeLog, safeWrite, wrapErrors, PrivacyError, sanitise, setFixtureNames } = require("../bench/model-eval/privacy.js");
// the fixture names this test uses; the gate lets through only names in the list, not any name of that shape
setFixtureNames(["r3-interview-2026-09-16", "r5-court-2026-09-16", "r12-meeting-2026-10-01"]);

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const refusal = (v) => { try { allow(v); return ""; } catch (e) { return e instanceof PrivacyError ? e.reason : "other:" + e.message; } };
const passes = (v, m) => { const r = refusal(v); ok(r === "", `${m} passes (refused: ${r})`); };
const refused = (v, reason, m) => { const r = refusal(v); ok(r === reason, `${m} is refused as ${reason} (got: ${r || "passed"})`); };

(async () => {
  console.log("\n— what passes —");
  for (const n of [0, 3, -2, 0.974, 12.5, 999999, 1234567.25]) passes(n, `the number ${n}`);
  for (const s of ["0.97", "12.5%", "-3", "1e-3", "100%", "262/6/7/4/31"]) passes(s, `"${s}"`);
  for (const s of ["PER", "ORG", "PLACE", "O", "B-PER", "I-GPE", "BIOES", "B_only"]) passes(s, `the label ${s}`);
  for (const s of ["base-q8", "large-q8", "hebert", "union-joint-base"]) passes(s, `the model key ${s}`);
  for (const s of ["P_ARABIC", "S_ALT", "I_ID", "L_NEIGHBOURHOOD"]) passes(s, `the category ${s}`);
  passes("r3-interview-2026-09-16", "a fixture folder name");
  passes("r12-meeting-2026-10-01 base-q8 found 7 missed 2 leaked 0", "a log line of a fixture's counts");
  for (const s of ["tp", "fp", "fn", "f1", "f2", "found", "missed", "leaked", "junk", "Recall"]) passes(s, `the metric ${s}`);
  passes(true, "a boolean"); passes(null, "null");
  passes({ model: "base-q8", set: "protocol", stage: "raw", threshold: 0.6, match: "overlap-untyped",
    micro: { tp: 262, fp: 6, fn: 7, p: 0.978, r: 0.974, f1: 0.976, f2: 0.975 },
    perType: { PER: { tp: 120, fp: 2, fn: 3 } }, ci95: { r: [0.95, 0.99], f2: [0.94, 0.99] } }, "a scores object");
  const table = [
    "## r5-court-2026-09-16",
    "",
    "| model | cat | found | missed | leaked | f2 |",
    "|:---|:---|---:|---:|---:|---:|",
    "| base-q8 | P_ARABIC | 12 | 1 | 0 | 0.93 |",
    "| joint-base | S_ALT | 4 | 0 | 0 | 1 |",
    "| **Total** | ALL | 16 | 1 | 0 | 0.95 |",
  ].join("\n");
  passes(table, "a Markdown table of counts");

  console.log("\n— what is refused —");
  refused("משה כהן", "hebrew", "Hebrew text");
  refused("found 3 בבית", "hebrew", "Hebrew inside an allowed line");
  refused({ tp: 3, "רחל": 1 }, "hebrew", "Hebrew as a field name");
  refused(["base-q8", ["tp", { cat: "לוי" }]], "hebrew", "Hebrew nested deep");
  refused("Cohen", "word", "a Latin surname");
  refused("COHEN", "word", "an all-caps Latin surname");
  refused("base-q8 found Dana", "word", "a Latin name in a log line");
  // the reviewer's two: a name shaped like a category, and one shaped like a fixture folder
  refused("COHEN_DANA", "word", "a surname and name shaped like a category");
  refused("r1-dana-2026-01-01", "word", "a fixture-shaped name that is not one of the fixtures");
  refused("123456789", "id-or-phone", "a 9-digit ID");
  refused(123456789, "id-or-phone", "a 9-digit ID as a number");
  refused("12345678-9", "id-or-phone", "an ID with its check digit apart");
  refused("123 456 789", "id-or-phone", "an ID written in groups");
  refused("050-1234567", "id-or-phone", "a mobile number");
  refused("050 123 4567", "id-or-phone", "a mobile number in groups");
  refused("03-6123456", "id-or-phone", "a landline");
  refused("+972 50 123 4567", "id-or-phone", "an international number");
  refused("dana.levi@example.com", "email", "an email address");
  refused("see https://example.org/x", "url", "a URL");
  refused("www.example.org", "url", "a URL without a scheme");
  refused("C:/Users/someone/private-bench/r3-interview-2026-09-16/key.json", "path", "a file path");
  refused("private-bench\\notes", "path", "a Windows path");
  refused("document.docx", "word", "a file name");
  ok(refusal("r3-Interview-2026-09-16x") !== "", "a near-miss of a fixture name is refused");
  refused(NaN, "non-finite-number", "NaN");
  refused(Infinity, "non-finite-number", "Infinity");
  refused(Buffer.from("abc"), "type bytes", "raw bytes");
  refused(() => 1, "type function", "a function");
  { const e = (() => { try { allow({ tp: 1, note: "Dana Levi" }); } catch (x) { return x; } })();
    ok(e && !/Dana|Levi/.test(e.message + e.stack), "a refusal does not quote what it refused"); }

  console.log("\n— what is refused: shapes that slipped through review —");
  // An ID in groups where one group is a single digit, or joined by Word's spaces and dashes.
  refused("5 123 456 789", "id-or-phone", "an ID after a one-digit group");
  refused("1234 5678 9", "id-or-phone", "an ID with a one-digit tail");
  refused("123" + String.fromCharCode(0xa0) + "456" + String.fromCharCode(0xa0) + "789", "id-or-phone", "an ID in groups joined by no-break spaces");
  refused("123\t456\t789", "id-or-phone", "an ID in groups joined by tabs");
  refused("123–456–789", "id-or-phone", "an ID in groups joined by en dashes");
  refused("050 – 123 4567", "id-or-phone", "a phone with a spaced dash");
  refused("123456789.5", "id-or-phone", "an ID with a fraction on it");
  passes("found 262 6 7 4 31", "a list of small counts");
  passes("| r3-interview-2026-09-16 | 12 | 345 |", "a fixture row whose date sits next to counts");
  // Objects that walk as one thing and print as another.
  refused(new String("123456789"), "type object", "a boxed string (walks as single digits)");
  refused({ tp: new Number(123456789) }, "type object", "a boxed number (walks as {})");
  refused({ tp: new URL("https://example.org/Dana") }, "type object", "a URL object (walks as {}, prints as text)");
  { class Row { toJSON() { return "Dana Levi"; } }
    refused({ tp: new Row() }, "type object", "a class whose toJSON prints text"); }
  refused({ tp: new Map([["Dana", 1]]) }, "type object", "a Map");
  { let n = 0; refused({ get tp() { return n++ ? "Dana" : 1; } }, "type accessor", "a getter that could answer differently"); }
  { const a = [1, 2]; a.tp = "Dana"; refused(a, "word", "a named field on an array"); }
  // A random hash could be a hashed ID (reversible by brute force); only the registry's pass.
  refused("ab".repeat(32), "hash", "a sha256 not in the registry");
  { const reg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bench", "model-eval", "registry.json"), "utf8"));
    const row = reg.find((x) => x.sha256) || {};
    if (row.sha256) { passes(row.sha256, "the registry's sha256 of " + row.key); passes(row.revision, "and its pinned revision"); } }
  // Timings of a long private scan are big whole numbers; only named timing and count fields take them.
  passes({ timing: { loadMs: 900, scanMs: 1234567, words: 2500000 } }, "a long scan's timing");
  refused({ tp: 1234567 }, "id-or-phone", "a big whole number under another name");
  refused({ scanMs: "1234567" }, "id-or-phone", "a big number as text, even under a timing name");

  console.log("\n— safeLog —");
  {
    const lines = [], orig = console.log;
    console.log = (...a) => lines.push(a.join(" "));
    let threw = null;
    try { safeLog("base-q8", "P_ARABIC", "found", 7, { tp: 7, fp: 0 }); safeLog("missed", "יוסי"); } catch (e) { threw = e; }
    console.log = orig;
    ok(lines.length === 1 && lines[0] === 'base-q8 P_ARABIC found 7 {"tp":7,"fp":0}', "an allowed line is printed as is");
    ok(threw instanceof PrivacyError && threw.reason === "hebrew", "a line with Hebrew is refused");
    ok(!lines.some((l) => /יוסי|missed/.test(l)), "and nothing of the refused line is printed");

    // Each argument passes alone; joined with spaces they would print an ID.
    const joined = [];
    console.log = (...a) => joined.push(a.join(" "));
    const errs = [];
    for (const args of [[123, 456, 789], ["12345", "6789"], ["050", 1234567]])
      try { safeLog(...args); } catch (e) { errs.push(e); }
    let t = null;
    try { safeLog("timing", { loadMs: 900, scanMs: 1234567 }); safeLog("tp", 262, 6, 7); } catch (e) { t = e; }
    console.log = orig;
    ok(errs.length === 3 && errs.every((e) => e instanceof PrivacyError), "arguments that join into an ID are refused");
    ok(!joined.some((l) => /123 456|12345 6789|050/.test(l)), "and not printed");
    ok(!t && joined.length === 2 && joined[1] === "tp 262 6 7", "a timing object and a count line still print");
  }

  console.log("\n— safeWrite —");
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-privacy-"));
    const json = path.join(dir, "sub", "scores.json");
    safeWrite(json, { model: "base-q8", micro: { tp: 3, fn: 1, r: 0.75 } });
    ok(JSON.parse(fs.readFileSync(json, "utf8")).micro.r === 0.75, "an allowed object is written as JSON");
    ok(fs.readFileSync(json, "utf8") === '{\n "model": "base-q8",\n "micro": {\n  "tp": 3,\n  "fn": 1,\n  "r": 0.75\n }\n}\n', "pretty-printed with a one-space indent");
    const md = path.join(dir, "table.md");
    safeWrite(md, table);
    ok(fs.readFileSync(md, "utf8") === table, "an allowed Markdown table is written as is");

    const bad = path.join(dir, "bad.md");
    let e1 = null;
    try { safeWrite(bad, table + "\n| base-q8 | 123456789 | 1 | 0 | 0 | 1 |"); } catch (e) { e1 = e; }
    ok(e1 instanceof PrivacyError, "a table with an ID in it is refused");
    ok(!fs.existsSync(bad), "and no file is left behind");
    let e2 = null;
    try { safeWrite(json, { model: "base-q8", note: "אבי" }); } catch (e) { e2 = e; }
    ok(e2 instanceof PrivacyError, "overwriting with refused content is refused");
    ok(JSON.parse(fs.readFileSync(json, "utf8")).micro.tp === 3, "and the earlier report is left untouched");
    ok(fs.readdirSync(dir).every((f) => !/\.tmp-/.test(f)) && fs.readdirSync(path.join(dir, "sub")).length === 1, "no temp file is left behind");

    const url = path.join(dir, "url.json");
    let e3 = null;
    try { safeWrite(url, { model: "base-q8", notes: new URL("https://example.org/Dana") }); } catch (e) { e3 = e; }
    ok(e3 instanceof PrivacyError && !fs.existsSync(url), "an object that serialises as text is refused, nothing written");
    const deep = path.join(dir, "new", "deeper", "x.md");
    try { safeWrite(deep, "found 3 Dana"); } catch (_) { /* refused */ }
    ok(!fs.existsSync(path.join(dir, "new")), "a refused write creates no folders either");
    let e4 = null;
    try { safeWrite(path.join(dir, "u.json"), undefined); } catch (e) { e4 = e; }
    ok(e4 instanceof TypeError && !fs.existsSync(path.join(dir, "u.json")), "undefined is not written as the word undefined");
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log("\n— wrapErrors —");
  {
    const secret = "שם הילד 123456789";
    let e = null;
    try { wrapErrors(() => { throw new TypeError("could not tokenize: " + secret); }); } catch (x) { e = x; }
    ok(e && e.name === "TypeError", "the error class is kept");
    ok(e && !/[\u0590-\u05FF]|123456789/.test(e.message) && !/[\u0590-\u05FF]|123456789/.test(e.stack), "Hebrew and the ID are gone from message and stack");
    ok(e && /me_privacy_t\.js:\d+/.test(e.stack), "the stack keeps file:line frames");
    ok(e && e.stack.split("\n").slice(1).every((l) => /^    at \S+:\d+$/.test(l)), "and nothing but file:line");

    let a = null;
    try { await wrapErrors(async () => { await null; const x = new RangeError("chunk: " + secret + "\n    at evil (C:/leak/Dana.js:1:1)"); throw x; }); } catch (x) { a = x; }
    ok(a && a.name === "RangeError" && !/[\u0590-\u05FF]|123456789|Dana/.test(a.message + a.stack), "an async rejection is sanitised too, including a message shaped like a frame");
    let s = null;
    try { await wrapErrors(() => Promise.reject(secret)); } catch (x) { s = x; }
    ok(s && s.name === "NonError" && !/[\u0590-\u05FF]/.test(s.message + s.stack), "a thrown string becomes a NonError with no text");
    ok(wrapErrors(() => 5) === 5 && (await wrapErrors(async () => 6)) === 6, "a value passes through unchanged");
    let p = null;
    try { wrapErrors(() => allow("Dana")); } catch (x) { p = x; }
    ok(p instanceof PrivacyError && p.reason === "word", "a privacy refusal keeps its reason");

    // ES module frames (transformers.js) are file:/// URLs; keep them, still as file:line only.
    const esm = new Error("tokenize: " + secret);
    esm.stack = "Error: tokenize: " + secret + "\n    at run (file:///C:/x/transformers.js:12:3)\n    at C:\\x\\run.js:4:1";
    const se = sanitise(esm);
    ok(/at file:\/\/\/C:\/x\/transformers\.js:12\n/.test(se.stack) && /at C:\\x\\run\.js:4$/.test(se.stack), "ES module frames are kept as file:line");
    // A message changed after the stack was taken: the old text is still cut off the top.
    const late = new Error("chunk " + secret);
    late.message = "other";
    let l = null;
    try { wrapErrors(() => { throw late; }); } catch (x) { l = x; }
    ok(l && !/[\u0590-\u05FF]|123456789/.test(l.message + l.stack), "a message changed after the throw still leaks nothing");
    let c = null;
    try { wrapErrors(() => { throw new Error("load failed", { cause: new Error(secret) }); }); } catch (x) { c = x; }
    ok(c && c.cause === undefined && !/[\u0590-\u05FF]/.test(require("util").inspect(c)), "a cause carrying text is dropped");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
