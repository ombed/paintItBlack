/* The session-log report (scripts/log-report.js): it reads old logs without
   the new fields, reads new ones in full, and refuses to print text. */
const { report } = require("../scripts/log-report.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— an old log (v35) has none of the new fields —");
{
  const t = report({ v: "v35", ms: 600000, events: [{ t: 1000, ev: "screen", to: "work", from: "people" }, { t: 5000, ev: "allow" }, { t: 9000, ev: "set-style", style: "black", changed: true, kind: "NAME" }, { t: 9100, ev: "model-start", blocks: 3, words: 40 }] });
  ok(t.includes("Minutes per screen: entry 0.0 · work 10.0"), "time per screen: " + t.split("\n")[2]);
  ok(t.includes("from ? (1)"), "a missing field shows as ?");
  ok(t.includes("Self-check: not in v35"), "no self-check before v45");
  ok(t.includes("no model-done event"), "the model line says what is missing");
}

console.log("\n— a new log is read in full —");
{
  const t = report({ v: "v48", ms: 120000, events: [
    { t: 1000, ev: "allow", src: "ms", kind: "NAME", words: 2, review: false, band: "high" },
    { t: 4000, ev: "set-rep", src: "h", kind: "NAME", words: 2, part: "first", gender: "changed", origin: "same", style: "name", was: "auto" },
    { t: 5000, ev: "miss", kind: "NAME", words: 1, occ: 3, model: "below", modelBounds: "cut-left", header: false, suggest: true, near: false, before: "prep", after: "verb", prefix: true, hyphen: false, geresh: false },
    { t: 6000, ev: "model-done", ms: 8200, cached: true, found: 4, names: 3, orgs: 1, places: 0, review: 0, spans: 9, high: 5, mid: 2, low: 1, below: 1 },
    { t: 7000, ev: "self-check", rule: "tip-drift", screen: "work", n: 1, ms: 3 },
    { t: 8000, ev: "page-error", name: "TypeError", screen: "work", tour: false },
  ] });
  ok(t.includes("allow: by source model+speaker (1)"), "the source code is spelled out");
  ok(t.includes("what changed first (1)") && t.includes("gender changed (1)") && t.includes("the pseudonym was auto (1)"), "a pseudonym change");
  ok(t.includes("model saw it below (1)") && t.includes("body scan suggested 1"), "a miss and what each layer thought");
  ok(t.includes("Model: 8.2 s (cached)") && t.includes("below .6 1"), "the model's run");
  ok(t.includes("tip-drift on work×1"), "a self-check break");
  ok(t.includes("Page errors: TypeError on work (1)"), "a page error");
  ok(t.includes("seconds between corrections: median 3"), "the pace of corrections");
}

console.log("\n— it refuses to print text —");
{
  let threw = false;
  try { report({ v: "v48", ms: 1, events: [{ t: 1, ev: "allow", src: "m", kind: "אבגד" }] }); } catch (_) { threw = true; }
  ok(threw, "a Hebrew word in any field stops the report");
}

console.log("\n— a file under four bytes gets a message, not a RangeError (review nit 9) —");
{
  const fs = require("fs"), os = require("os"), path = require("path");
  const { readLog } = require("../scripts/log-report.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pib-log-"));
  for (const bytes of ["", "{}", "abc"]) {
    const f = path.join(dir, "short.json");
    fs.writeFileSync(f, bytes);
    let err = null;
    try { readLog(f); } catch (e) { err = e; }
    ok(err && !(err instanceof RangeError) && /not a session log/.test(err.message), `${bytes.length} bytes: ${err ? err.name + ": " + err.message : "no error"}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
