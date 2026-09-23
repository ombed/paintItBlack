/* The smoke run (PLAN.md run order 3, checkpoint 1): every deployable tier-1 model, and each
   DictaBERT-family one again with the faithful tokenizer, on t1 and f1, protocol.txt and the
   known cases. It shows that each loads, that its health is clean and that its numbers are
   plausible. It decides nothing.

     node bench/model-eval/smoke.js [key ...]

   Each run is its own run.js process (models do not share memory). Needs the gold sets that
   gold-synth.js and known-cases.js write under out/gold/. Writes out/smoke/ (predictions,
   smoke.json, smoke.md) and prints the table. Invented and public text only. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { score } = require("./score-spans.js");
const { judge } = require("./known-score.js");
const { readRegistry, modelFile } = require("./load.js");

const OUT = path.join(__dirname, "out", "smoke");
const GOLD = path.join(__dirname, "out", "gold");
// the tokenizers that need the faithful rewrite (tok-parity.js): the DictaBERT family
const NEEDS_FT = new Set(["base-q8", "tiny-parse", "iahlt-base", "msperka-dicta", "joint-base", "parse-base", "large-q8"]);

function sets() {
  const all = JSON.parse(fs.readFileSync(path.join(GOLD, "synthetic-all.json"), "utf8"));
  const synth = Object.assign({}, all, { name: "smoke-synth", docs: all.docs.filter((d) => d.id === "t1" || d.id === "f1") });
  fs.mkdirSync(OUT, { recursive: true });
  const synthFile = path.join(OUT, "smoke-synth.json");
  fs.writeFileSync(synthFile, JSON.stringify(synth));
  return [
    { name: "smoke-synth", file: synthFile },
    { name: "protocol", file: path.join(__dirname, "gold", "protocol.json") },
    { name: "known-cases", file: path.join(GOLD, "known-cases.json") },
  ];
}

// the deployable rows: q8 files of tier 1 that are on disk (fp32 and uint8 are references)
function runs(keys) {
  const out = [];
  for (const s of readRegistry()) {
    if (s.tier !== 1 || s.dtype !== "q8" || (keys.length && !keys.includes(s.key))) continue;
    if (!fs.existsSync(modelFile(s))) { out.push({ key: s.key, tok: "product", absent: true }); continue; }
    out.push({ key: s.key, tok: "product" });
    if (NEEDS_FT.has(s.key)) out.push({ key: s.key, tok: "faithful" });
  }
  return out;
}

const f3 = (x) => (x == null ? "–" : x.toFixed(3));

function main(keys) {
  const S = sets();
  for (const s of S) if (!fs.existsSync(s.file)) throw new Error(`${s.name}: ${path.relative(process.cwd(), s.file)} is missing (run gold-synth.js and known-cases.js first)`);
  const gold = Object.fromEntries(S.map((s) => [s.name, JSON.parse(fs.readFileSync(s.file, "utf8"))]));
  const rows = [];
  for (const r of runs(keys)) {
    const name = r.key + (r.tok === "faithful" ? "-ft" : "");
    if (r.absent) { rows.push({ name, absent: true }); console.log(`${name}: model file not on disk, skipped`); continue; }
    const row = { name, key: r.key, tok: r.tok, sets: {} };
    for (const s of S) {
      const args = [path.join(__dirname, "run.js"), "--model", r.key, "--set", s.file, "--out", path.join(OUT, "pred"), "--tok", r.tok];
      const p = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 << 20, timeout: 1800000 });
      const base = path.join(OUT, "pred", `${name}.${s.name}`);
      if (p.status !== 0 && p.status !== 2) { row.sets[s.name] = { error: String(p.stderr).split("\n").filter(Boolean).slice(-1)[0] || "exit " + p.status }; continue; }
      const raw = JSON.parse(fs.readFileSync(base + ".raw.json", "utf8"));
      const cl = JSON.parse(fs.readFileSync(base + ".cleaned.json", "utf8"));
      const h = raw.health, t = raw.timing;
      const x = { healthOk: p.status === 0, health: h, msPer1kWords: t.words ? Math.round(t.scanMs / t.words * 1000) : null, loadMs: t.loadMs };
      if (s.name === "known-cases") {
        const J = judge(gold[s.name], cl);
        x.known = { passed: J.totals.passed, cases: J.totals.cases, controls: J.controls.passed, failed: J.cases.filter((c) => !c.pass && !c.control).map((c) => c.id) };
      } else {
        const c = score(gold[s.name], cl, { match: "overlap-untyped" });
        const w = score(gold[s.name], raw, { match: "word-exact", threshold: 0.5 });
        x.cleaned = { p: c.micro.p, r: c.micro.r, f2: c.micro.f2, n: c.n.gold, entR: c.entity.r, traps: c.trap.hit };
        x.rawExact = { p: w.micro.p, r: w.micro.r, f2: w.micro.f2 };
      }
      row.sets[s.name] = x;
    }
    rows.push(row);
    const k = row.sets["known-cases"], ps = row.sets.protocol, sy = row.sets["smoke-synth"];
    console.log(`${name}: synth R ${f3(sy && sy.cleaned && sy.cleaned.r)} · protocol R ${f3(ps && ps.cleaned && ps.cleaned.r)} P ${f3(ps && ps.cleaned && ps.cleaned.p)} · known ${k && k.known ? k.known.passed + "/" + k.known.cases : "–"}`);
  }
  fs.writeFileSync(path.join(OUT, "smoke.json"), JSON.stringify(rows, null, 1) + "\n");
  fs.writeFileSync(path.join(OUT, "smoke.md"), render(rows));
  console.log("\n" + render(rows));
}

function render(rows) {
  const L = ["| Model | t1+f1 cleaned P / R / F2 | protocol cleaned P / R / F2 | protocol raw word-exact F2 @0.5 | Known cases | Health | ms per 1k words |", "|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    if (r.absent) { L.push(`| ${r.name} | not on disk | | | | | |`); continue; }
    const sy = r.sets["smoke-synth"] || {}, pr = r.sets.protocol || {}, kc = r.sets["known-cases"] || {};
    const c3 = (x) => (x && x.cleaned ? `${f3(x.cleaned.p)} / ${f3(x.cleaned.r)} / ${f3(x.cleaned.f2)}` : x && x.error ? "error" : "–");
    const hs = Object.values(r.sets);
    const bad = hs.filter((x) => x.error || !x.healthOk).length;
    const al = hs.reduce((n, x) => n + (x.health ? x.health.alignFailEntityTokens : 0), 0);
    L.push(`| ${r.name} | ${c3(sy)} | ${c3(pr)} | ${pr.rawExact ? f3(pr.rawExact.f2) : "–"} | ${kc.known ? kc.known.passed + "/" + kc.known.cases : "–"} | ${bad ? "FAIL (" + bad + ")" : "ok"}${al ? ", " + al + " entity tokens unplaced" : ""} | ${pr.msPer1kWords ?? "–"} |`);
  }
  return L.join("\n") + "\n";
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e && e.stack || e); process.exitCode = 1; }
}
module.exports = { runs, render };
