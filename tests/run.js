/* Runs the Node suites. Regenerates the fixtures first, so the engine under
   test is always the one in the repo rather than a stale copy.

   Two lists, on purpose.

   SUITES run. BLOCKED do not, and the reason is the same for all four: they
   drive the vanilla UI through jsdom, reaching for element ids like oNer and
   s1..s4 and calling globals like showPeople(). This build renders its UI
   from a template at runtime and has none of those ids, so the suites throw
   before their first assertion. Making them run means rewriting them, and
   they were handed over with an explicit instruction not to, because their
   assertions encode bugs that took a while to find. race_t.js is the one
   that stings: it covers name leakage between cases. The guard it checks is
   present in index.html, but nothing here proves it still works.

   Their equivalent now lives in e2e/, which drives the real UI in a real
   browser. Porting these four is the way to close the gap.

   gap.js, real.js and perf.js are absent from both lists: per tests/README
   they are measurement tools that print a report, not a score. */
const { spawnSync } = require("child_process");

const HERE = __dirname;
const SUITES = [
  "t.js", "e2e.js", "edge.js", "ner_t.js", "tok_t.js",
  "align_t.js", "diag_t.js", "org_t.js", "case.js",
];
const BLOCKED = [
  ["flow.js", 26], ["theme_t.js", 13], ["race_t.js", 6], ["ui.js", 0],
];

const build = spawnSync(process.execPath, ["build-fixtures.js"], { cwd: HERE, encoding: "utf8" });
process.stdout.write(build.stdout || "");
if (build.status !== 0) {
  process.stderr.write(build.stderr || "");
  process.exit(1);
}

let pass = 0, fail = 0, broke = 0;
const rows = [];

for (const suite of SUITES) {
  const r = spawnSync(process.execPath, [suite], { cwd: HERE, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const m = out.match(/(\d+) passed, (\d+) failed/);
  if (m) {
    const p = Number(m[1]), f = Number(m[2]);
    pass += p; fail += f;
    rows.push([suite, String(p), String(f), f ? "FAIL" : "ok"]);
    if (f) process.stdout.write("\n--- " + suite + " ---\n" + out.trim() + "\n");
  } else {
    broke++;
    rows.push([suite, "-", "-", "ERROR"]);
    process.stdout.write("\n--- " + suite + " reported no tally ---\n" +
      out.trim().split("\n").slice(0, 12).join("\n") + "\n");
  }
}

console.log("\n" + "suite".padEnd(14) + "pass".padStart(6) + "fail".padStart(6) + "  status");
for (const [s, p, f, st] of rows) {
  console.log(s.padEnd(14) + p.padStart(6) + f.padStart(6) + "  " + st);
}

const skipped = BLOCKED.reduce((n, [, c]) => n + c, 0);
console.log("\nnot run, vanilla UI only (see the note in this file):");
for (const [s, c] of BLOCKED) console.log("  " + s.padEnd(12) + (c ? c + " assertions" : "element presence"));

console.log(`\n${pass} passed, ${fail} failed, ${broke} could not run` +
  `  ·  ${skipped} assertions skipped in ${BLOCKED.length} blocked suites\n`);
process.exit(fail || broke ? 1 : 0);
