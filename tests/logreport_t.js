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

console.log("\n— the v53 events are summarised, not lumped under 'other' —");
{
  const t = report({ v: "v53", ms: 600000, events: [
    { t: 1000, ev: "pdf-image-pages", n: 2, of: 9 },
    { t: 2000, ev: "model-partial", failed: 1, of: 6 },
    { t: 3000, ev: "file-early" },
    { t: 4000, ev: "run", applied: 10, flagged: 2, near: 1, suggest: 3, passed: false, incomplete: "body,labels" },
    { t: 5000, ev: "run", applied: 11, flagged: 0, near: 0, suggest: 0, passed: true, incomplete: "" },
    { t: 6000, ev: "export-ask", what: "download", open: 2, verifyFailed: true, incomplete: true },
    { t: 7000, ev: "export-ask", act: "anyway", what: "download" },
    { t: 7500, ev: "export-ask", act: "show" },
    { t: 8000, ev: "self-check-full", screen: "work" },
    { t: 9000, ev: "model-forget" },
  ] });
  const line = (p) => t.split("\n").find((l) => l.startsWith(p)) || "none";
  ok(t.includes("Runs: 2 · verification passed 1/2 · incomplete on 1: body (1) · labels (1)"), "the run line: " + line("Runs"));
  ok(t.includes("model could not read 1 of 6 chunks"), "a partial model run");
  ok(t.includes("PDF pages that are images: 2 of 9"), "image pages in a PDF");
  ok(t.includes("file chosen before the tool was ready: 1"), "an early file");
  ok(t.includes("Export asked: 1 (download (1)) · open items 1 · verification failed 1 · scan incomplete 1 · then: anyway (1) · show (1)"), "the export question: " + line("Export"));
  ok(t.includes("the self-check stopped listing new breaks (40 distinct) on work"), "a full self-check");
  ok(t.includes("model deleted from the computer: 1"), "the model forgotten");
  const other = line("Other events");
  ok(!/run|export-ask|model-partial|pdf-image|file-early|self-check-full|model-forget/.test(other), "none of them left under other: " + other);
}

console.log("\n— one page load, several documents —");
{
  const t = report({ v: "v53", ms: 900000, events: [
    { t: 60000, ev: "screen", to: "work", from: "people" },
    { t: 120000, ev: "allow", src: "m" }, { t: 130000, ev: "set-rep", src: "m" },
    { t: 300000, ev: "new-doc" }, { t: 300000, ev: "screen", to: "entry", from: "work" },
    { t: 360000, ev: "screen", to: "work", from: "entry" },
    { t: 400000, ev: "allow", src: "b" },
  ] });
  ok(t.includes("Documents: 2 · doc 1 5.0 min, 2 corrections, 80% on work · doc 2 10.0 min, 1 correction, 90% on work"), "per document: " + (t.split("\n").find((l) => l.startsWith("Documents")) || "none"));
}

console.log("\n— a package is read with its leak report —");
{
  const fs = require("fs"), os = require("os"), path = require("path");
  const { mkzip } = require("./mkzip.js");
  const { readPackage } = require("../scripts/log-report.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pib-pkg-"));
  try {
    const f = path.join(dir, "paintItBlack-package-2026-01-01");
    const leak = { tool: "paintItBlack", v: "v53", count: 1, shapes: [{ kind: "NAME", words: 1, lens: [4], before: "title", after: "verb" }] };
    fs.writeFileSync(f, Buffer.from(mkzip([{ name: "session-log.json", body: JSON.stringify({ v: "v53", ms: 1, events: [] }) }, { name: "leak-report.json", body: JSON.stringify(leak) }])));
    const p = typeof readPackage === "function" ? readPackage(f) : {};
    ok(p.log && p.log.v === "v53" && p.leaks && p.leaks.shapes.length === 1, "the log and the leak report come out of one zip");
    const g = path.join(dir, "no-leaks");
    fs.writeFileSync(g, Buffer.from(mkzip([{ name: "session-log.json", body: JSON.stringify({ v: "v53", ms: 1, events: [] }) }])));
    ok(typeof readPackage === "function" && readPackage(g).leaks === null, "a package without a leak report says so");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log("\n— it refuses to print text —");
{
  let threw = false;
  try { report({ v: "v48", ms: 1, events: [{ t: 1, ev: "allow", src: "m", kind: "אבגד" }] }); } catch (_) { threw = true; }
  ok(threw, "a Hebrew word in any field stops the report");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
