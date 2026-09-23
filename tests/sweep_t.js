/* bench/sweep.js --only re-runs one parameter and keeps every other section (outside
   review, M13). It used to write sweep.md from scratch outside the --only loop, so a
   partial re-run cut the file from thirteen sections to one. Here a made-up sweep.md
   with two sections is seeded in a temp directory, one of them is re-run model-off
   (the corpus, no model: a few seconds), and the other must come back unchanged.
   The committed bench/sweep.md is checked untouched, and put back if it was not. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ROOT = path.join(__dirname, "..");
const SWEEP = path.join(ROOT, "bench", "sweep.js");
const COMMITTED = path.join(ROOT, "bench", "sweep.md");
const before = fs.readFileSync(COMMITTED, "utf8");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pib-sweep-"));

const KEPT = [
  "## prefixes — list rules: prefix-letter forms generated",
  "",
  "| value | leaks | missed | fp | junk | ms |",
  "|---|---|---|---|---|---|",
  "| off | 16 | 4 | 2 | 42 | 2677 |",
  "| normal ◀ | 4 | 4 | 2 | 42 | 2703 |",
].join("\n");
const REPLACED = [
  "## body — verb layer (bodyNames) while the model runs",
  "",
  "| value | leaks | missed | fp | junk | ms |",
  "|---|---|---|---|---|---|",
  "| off | 999 | 999 | 9 | 9 | 1 |",
  "| on ◀ | 998 | 998 | 9 | 9 | 1 |",
].join("\n");
fs.writeFileSync(path.join(dir, "sweep.md"), ["# Parameter sweep", "", "Model on. Generated 2000-01-01.", "", REPLACED, "", KEPT, ""].join("\n"));
fs.writeFileSync(path.join(dir, "sweep.json"), JSON.stringify([
  { param: "body", value: "off", leaked: 999 }, { param: "prefixes", value: "off", leaked: 16 },
]));

const run = (...args) => spawnSync(process.execPath, [SWEEP, "--no-model", `--out=${dir}`, ...args], { cwd: ROOT, encoding: "utf8", timeout: 240000 });

try {
  console.log("\n— --only=body re-runs one section and keeps the other —");
  const r = run("--only=body");
  ok(r.status === 0, "the sweep ran: exit " + r.status + " " + (r.stderr || "").split("\n").slice(-3).join(" "));
  const md = fs.readFileSync(path.join(dir, "sweep.md"), "utf8");
  ok(md.includes(KEPT), "the section not re-run is kept byte for byte");
  ok(!md.includes("999"), "the re-run section replaced its old numbers");
  ok((md.match(/^## body — /gm) || []).length === 1, "the re-run section appears once");
  ok(md.indexOf("## body — ") < md.indexOf("## prefixes — "), "sections stay in parameter order");
  ok(/## body — [^\n]*\n\nModel off, \d+ documents, commit \S+, generated \d{4}-\d\d-\d\d\./.test(md), "the re-run section says model off, the commit and the date");
  const rows = JSON.parse(fs.readFileSync(path.join(dir, "sweep.json"), "utf8"));
  ok(rows.some((x) => x.param === "prefixes" && x.leaked === 16), "sweep.json keeps the other parameter's rows");
  ok(rows.filter((x) => x.param === "body").length === 2 && !rows.some((x) => x.leaked === 999), "sweep.json replaces the re-run parameter's rows");

  console.log("\n— an unknown --only writes nothing —");
  const md0 = fs.readFileSync(path.join(dir, "sweep.md"), "utf8");
  const bad = run("--only=noSuchParam");
  ok(bad.status !== 0, "an unknown parameter is an error");
  ok(fs.readFileSync(path.join(dir, "sweep.md"), "utf8") === md0, "and sweep.md is untouched");
} finally {
  const after = fs.readFileSync(COMMITTED, "utf8");
  ok(after === before, "the committed bench/sweep.md is untouched when --out is given");
  if (after !== before) fs.writeFileSync(COMMITTED, before);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
