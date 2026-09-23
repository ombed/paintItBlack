/* Runs the Node suites. Regenerates the fixtures first from redact-engine.js, so the
   suites test the bundle in the repo rather than a stale copy of it. The bundle itself is
   built from engine/*.js by `npm run build:engine`; tests/engine_t.js fails if the two differ.

   Two lists, on purpose.

   SUITES run. BLOCKED do not, and the reason is the same for all four: they
   drive the vanilla UI through jsdom, reaching for element ids like oNer and
   s1..s4 and calling globals like showPeople(). This build renders its UI
   from a template at runtime and has none of those ids, so the suites throw
   before their first assertion. Their selectors are disposable; their intent
   is not, so it was ported to e2e/, where it runs against the real UI in a
   real browser:

     race_t.js  -> e2e/race.spec.js   both scenarios, on the real guard
     theme_t.js -> e2e/theme.spec.js  tokens, dark toggle, persistence
     ui.js      -> e2e/ui.spec.js     controls per screen, no page errors
     flow.js    -> e2e/flow.spec.js   header fill, list editing, fallback, env hints, regex,
                                      the flag after a failed model load and the local-file
                                      load (review L4). Its "model off by default" is obsolete:
                                      the model is on by default (PLAN-v18 Q13).

   The originals stay here untouched as the record of what they asserted.

   gap.js, real.js and perf.js are absent from both lists: per tests/README
   they are measurement tools that print a report, not a score. */
const { spawnSync } = require("child_process");

const HERE = __dirname;
const SUITES = [
  "t.js", "e2e.js", "edge.js", "ner_t.js", "tok_t.js",
  "align_t.js", "diag_t.js", "org_t.js", "case.js", "version_t.js", "design_t.js", "engine_t.js", "pagelogic_t.js", "regex_t.js", "places_t.js", "numbers_t.js", "private_t.js", "allow_t.js", "omit_t.js", "orgs_t.js", "atlas_t.js", "merge_t.js", "phrase_t.js", "r3_t.js", "site_t.js", "r5_t.js", "shapes_t.js", "prcheck_t.js", "structure_t.js", "harvest_t.js", "logreport_t.js", "state_t.js", "runner_t.js", "passes_t.js", "benchlib_t.js", "license_t.js", "failopen_t.js", "gate_t.js", "vendor_t.js",
];
const BLOCKED = [
  ["flow.js", 26], ["theme_t.js", 13], ["race_t.js", 6], ["ui.js", 0],
];

const build = process.env.PIB_SUITES ? { status: 0, stdout: "" } : spawnSync(process.execPath, ["build-fixtures.js"], { cwd: HERE, encoding: "utf8" });
process.stdout.write(build.stdout || "");
if (build.status !== 0) {
  process.stderr.write(build.stderr || "");
  process.exit(1);
}

let pass = 0, fail = 0, broke = 0;
const rows = [];

/* A suite's word is not taken alone (outside review, M7). Its exit code counts: a suite that
   prints a green tally and then exits non-zero used to be reported "ok". And its size is
   pinned from below: tests/floors.json holds the number of checks each suite reported when
   the floor was last raised, and a suite that reports fewer has silently stopped running
   something. Adding checks never needs an update; removing them does, on purpose:
   `node tests/run.js --update-floors`. */
// PIB_SUITES and PIB_FLOORS let tests/runner_t.js run this file over made-up suites
const RUN = process.env.PIB_SUITES ? process.env.PIB_SUITES.split(",") : SUITES;
const FLOORS_FILE = process.env.PIB_FLOORS || require("path").join(HERE, "floors.json");
const floors = require("fs").existsSync(FLOORS_FILE) ? JSON.parse(require("fs").readFileSync(FLOORS_FILE, "utf8")) : {};
const seen = {};

for (const suite of RUN) {
  const r = spawnSync(process.execPath, [suite], { cwd: HERE, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const all = [...out.matchAll(/(\d+) passed, (\d+) failed/g)];
  const m = all[all.length - 1];
  if (m) {
    const p = Number(m[1]), f = Number(m[2]);
    pass += p; fail += f; seen[suite] = p;
    const exited = r.status !== 0 && !f, shrunk = !f && suite in floors && p < floors[suite];
    if (exited || shrunk) broke++;
    rows.push([suite, String(p), String(f), f ? "FAIL" : exited ? "EXIT " + r.status : shrunk ? "SHRUNK" : "ok"]);
    if (f || exited) process.stdout.write("\n--- " + suite + " ---\n" + out.trim() + "\n");
    if (shrunk) process.stdout.write("\n--- " + suite + " reported " + p + " checks, fewer than its floor of " + floors[suite] + " ---\n");
  } else {
    broke++;
    rows.push([suite, "-", "-", "ERROR"]);
    process.stdout.write("\n--- " + suite + " reported no tally ---\n" +
      out.trim().split("\n").slice(0, 12).join("\n") + "\n");
  }
}
if (process.argv.includes("--update-floors")) {
  require("fs").writeFileSync(FLOORS_FILE, JSON.stringify(seen, null, 1) + "\n");
  console.log("\nfloors written to tests/floors.json");
}
for (const s of RUN) if (!(s in floors) && !process.argv.includes("--update-floors")) console.log("note: " + s + " has no floor yet; run with --update-floors");

console.log("\n" + "suite".padEnd(14) + "pass".padStart(6) + "fail".padStart(6) + "  status");
for (const [s, p, f, st] of rows) {
  console.log(s.padEnd(14) + p.padStart(6) + f.padStart(6) + "  " + st);
}

const skipped = BLOCKED.reduce((n, [, c]) => n + c, 0);
console.log("\nnot run here, vanilla UI only; intent ported to e2e/:");
for (const [s, c] of BLOCKED) console.log("  " + s.padEnd(12) + (c ? c + " assertions" : "element presence"));

console.log(`\n${pass} passed, ${fail} failed, ${broke} could not run` +
  `  ·  ${skipped} assertions skipped in ${BLOCKED.length} blocked suites\n`);
process.exit(fail || broke ? 1 : 0);
