/* The full run (PLAN.md run order 4, Phase 4): every row on every set, the product runs, the
   comparison.

     node bench/model-eval/full.js [--skip=model,private,product] [key ...]

   Rows: the smoke rows (smoke.js runs(): every tier-1 q8 on disk, and each DictaBERT-family
   model again with the faithful tokenizer). Each step is its own process:
     1. run.js on the synthetic tune and test halves, protocol.txt, NEMO test, BMC test 1,
        Knesset UD and the known cases -> out/full/pred/
     2. run.js --private --offline on her gold set (gold-private.js) -> private-bench/model-eval/pred/
     3. product.js --tag=full (the whole chain, synthetic and hers) -> out/product/, private-bench/model-eval/product/
     4. compare.js on the public sets -> out/full/compare.md; with --private on hers ->
        private-bench/model-eval/compare-private.md (counts only)
     5. the known cases judged per row -> out/full/known.json
   A step that fails is logged and the run goes on; the summary lists every failure. Invented,
   public and her text are kept apart exactly as run.js, product.js and compare.js keep them. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { runs } = require("./smoke.js");
const { readRegistry } = require("./load.js");
const { judge } = require("./known-score.js");

const HERE = __dirname;
const OUT = path.join(HERE, "out", "full");
const PRIV = path.join(HERE, "..", "..", "..", "private-bench", "model-eval");
const GOLDS = [
  ["synthetic-tune", path.join(HERE, "out", "gold", "synthetic-tune.json")],
  ["synthetic-test", path.join(HERE, "out", "gold", "synthetic-test.json")],
  ["protocol", path.join(HERE, "gold", "protocol.json")],
  ["nemo-test", path.join(HERE, "..", "..", "..", "public-bench", "gold", "nemo-test.json")],
  ["bmc-test1", path.join(HERE, "..", "..", "..", "public-bench", "gold", "bmc-test1.json")],
  ["knesset-ud", path.join(HERE, "..", "..", "..", "public-bench", "gold", "knesset-ud.json")],
  ["known-cases", path.join(HERE, "out", "gold", "known-cases.json")],
];
const HELDOUT = ["protocol", "nemo-test", "bmc-test1", "knesset-ud"];

const failures = [];
function step(label, args, opt) {
  const t0 = Date.now();
  const p = spawnSync(process.execPath, args, Object.assign({ encoding: "utf8", maxBuffer: 256 << 20, timeout: 3600000 }, opt || {}));
  // run.js exits 2 on a health failure: the files are written, the health is in them
  const ok = p.status === 0 || p.status === 2;
  const last = String(p.stdout || "").split("\n").filter(Boolean).filter((l) => !/^תוקנו/.test(l)).slice(-2).join(" | ");
  console.log(`${ok ? "ok  " : "FAIL"} ${label} (${Math.round((Date.now() - t0) / 1000)}s)${p.status === 2 ? " health" : ""}${last ? ": " + last.slice(0, 160) : ""}`);
  if (!ok) { failures.push(label); console.log("     " + String(p.stderr || "").split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 300)); }
  return ok;
}

function main() {
  const argv = process.argv.slice(2);
  const skip = new Set((argv.find((a) => a.startsWith("--skip=")) || "--skip=").slice(7).split(",").filter(Boolean));
  const keys = argv.filter((a) => !a.startsWith("--"));
  const rows = runs(keys).filter((r) => !r.absent);
  for (const [name, f] of GOLDS) if (!fs.existsSync(f)) throw new Error(`gold set ${name} is missing: ${f}`);
  fs.mkdirSync(path.join(OUT, "gold"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "pred"), { recursive: true });
  // compare.js reads gold sets and predictions from the folders it is given
  for (const [name, f] of GOLDS) fs.copyFileSync(f, path.join(OUT, "gold", name + ".json"));
  fs.writeFileSync(path.join(OUT, "registry-all.json"), JSON.stringify(readRegistry(), null, 1) + "\n");
  console.log(`${rows.length} rows: ${rows.map((r) => r.key + (r.tok === "faithful" ? "-ft" : "")).join(" ")}`);

  for (const r of rows) {
    const name = r.key + (r.tok === "faithful" ? "-ft" : "");
    if (!skip.has("model")) for (const [set, f] of GOLDS)
      step(`${name} ${set}`, [path.join(HERE, "run.js"), "--model", r.key, "--tok", r.tok, "--set", f, "--out", path.join(OUT, "pred")]);
    if (!skip.has("private") && fs.existsSync(path.join(PRIV, "gold", "private.json")))
      step(`${name} private`, [path.join(HERE, "run.js"), "--private", "--offline", "--model", r.key, "--tok", r.tok, "--set", path.join(PRIV, "gold", "private.json")]);
    if (!skip.has("product"))
      step(`${name} product`, [path.join(HERE, "product.js"), `--model=${r.key}`, `--tok=${r.tok}`, `--tag=full${r.tok === "faithful" ? "-ft" : ""}`, "--against=base-q8:a"]);
  }

  step("compare public", [path.join(HERE, "compare.js"), `--dir=${OUT}`, `--registry=${path.join(OUT, "registry-all.json")}`,
    `--heldout=${HELDOUT.join(",")}`, `--out=${path.join(OUT, "compare.md")}`]);
  if (fs.existsSync(path.join(PRIV, "gold", "private.json")))
    step("compare private", [path.join(HERE, "compare.js"), "--private", `--dir=${path.join(PRIV, "gold")}`, `--dir=${path.join(PRIV, "pred")}`,
      `--registry=${path.join(OUT, "registry-all.json")}`, `--out=${path.join(PRIV, "compare-private.md")}`]);

  // the known cases, judged on the cleaned stage by their written rules
  const kc = JSON.parse(fs.readFileSync(path.join(OUT, "gold", "known-cases.json"), "utf8"));
  const known = [];
  for (const r of rows) {
    const name = r.key + (r.tok === "faithful" ? "-ft" : "");
    const f = path.join(OUT, "pred", `${name}.known-cases.cleaned.json`);
    if (!fs.existsSync(f)) continue;
    const J = judge(kc, JSON.parse(fs.readFileSync(f, "utf8")));
    known.push({ model: name, passed: J.totals.passed, cases: J.totals.cases, byGroup: J.totals.byGroup, buckets: J.totals.buckets,
      controls: J.controls.passed, failed: J.cases.filter((c) => !c.pass && !c.control).map((c) => c.id) });
  }
  fs.writeFileSync(path.join(OUT, "known.json"), JSON.stringify(known, null, 1) + "\n");
  console.log("\nknown cases: " + known.map((k) => `${k.model} ${k.passed}/${k.cases}`).join(", "));
  console.log(failures.length ? `\n${failures.length} step(s) failed: ${failures.join("; ")}` : "\nevery step ran");
  if (failures.length) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e && e.stack || e); process.exitCode = 1; }
}
