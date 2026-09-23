/* The decision table for checkpoint 2 (PLAN.md section 1 and schedule), one row per model:

     node bench/model-eval/decision.js [--finalists=a,b]

   - rule 1, safety: the whole chain (product.js --tag=full[-ft]) against today's run
     (base-q8:a), entity by entity with gate.js's compare, on the synthetic set and on hers;
     only a new leak or miss outside the baseline's noise band counts, and total leaks and
     misses must not go up;
   - rule 2a, better reading: the pooled held-out recall gain from compare.md (or
     compare-finalists.md for the finalists, at 97.5%);
   - rule 2b, her time: model-only suggestions in the whole chain on her documents, less the
     ones judged real names (judge.js labels), against today's model;
   - size from the registry, Node scan time per 1k words from the BMC run, the known cases.
   Her part is counts only. Writes out/full/decision.md and prints it. */
const fs = require("fs");
const path = require("path");
const E = require("../engine.js");
const { compare } = require("../gate.js");
const { readRegistry } = require("./load.js");

const HERE = __dirname;
const OUT = path.join(HERE, "out", "full");
const PRIV = path.join(HERE, "..", "..", "..", "private-bench", "model-eval");
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const idOf = (line) => line.slice(0, line.indexOf(": "));
const totals = (R) => {
  const s = R.rows.filter((r) => r.found !== null);
  return { found: s.filter((r) => r.found).length, missed: R.totals.missed, leaked: R.totals.leaked, fp: R.totals.fp };
};

function safety(dir, bandFile, file) {
  const base = read(path.join(dir, "base-q8-a.json")), R = read(path.join(dir, file));
  const band = new Set(fs.existsSync(bandFile) ? read(bandFile).entities : []);
  const c = compare(base, R);
  const newBad = new Set(c.worse.filter((l) => /now leaks|now missed/.test(l)).map(idOf).filter((id) => !band.has(id)));
  const t = totals(R), b = totals(base);
  return { t, newBad: newBad.size, pass: newBad.size === 0 && t.leaked <= b.leaked && t.missed <= b.missed };
}

// model-only whole-chain suggestions on her documents, less those judged real names
function junk(file) {
  const items = read(path.join(PRIV, "judge", "items.json")), labels = read(path.join(PRIV, "judge", "labels.json"));
  const vals = read(path.join(PRIV, "judge", "labels-values.json")).values;
  const lab = new Map();
  for (const x of items) { const k = E.norm(x.text).trim(); if (!lab.has(k) || labels[x.id] === "name") lab.set(k, labels[x.id]); }
  for (const [v, l] of Object.entries(vals)) lab.set(E.norm(v).trim(), l);
  const R = read(path.join(PRIV, "product", file));
  const mo = R.unlisted.filter((u) => u.sources.length === 1 && u.sources[0] === "model");
  return { modelOnly: mo.length, junk: mo.filter((u) => lab.get(E.norm(u.value).trim()) !== "name").length };
}

function gains(md) {
  const out = {};
  for (const block of md.split(/^### `/m).slice(1)) {
    const m = block.slice(0, block.indexOf("`"));
    const g = /pooled gain untyped ([+-][\d.]+) \[([-\d.]+), ([-\d.]+)\], PER ([+-][\d.]+) \[([-\d.]+), ([-\d.]+)\] at ([\d.]+)%/.exec(block);
    const st = /Rule 2a: \*\*(\w+)\*\*/.exec(block);
    if (g) out[m] = { u: +g[1], lo: +g[2], hi: +g[3], per: +g[4], perLo: +g[5], level: g[7], st: st ? st[1] : "?" };
  }
  return out;
}

function main() {
  const fin = ((process.argv.find((a) => a.startsWith("--finalists=")) || "").slice(12)).split(",").filter(Boolean);
  const G = gains(fs.readFileSync(path.join(OUT, "compare.md"), "utf8"));
  const F = fs.existsSync(path.join(OUT, "compare-finalists.md")) ? gains(fs.readFileSync(path.join(OUT, "compare-finalists.md"), "utf8")) : {};
  const known = Object.fromEntries(read(path.join(OUT, "known.json")).map((k) => [k.model, k]));
  const reg = new Map(readRegistry().map((r) => [r.key, r]));
  const pdir = path.join(HERE, "out", "product");
  const baseJunk = junk("base-q8-a.json");
  const speed = (m) => { const f = path.join(OUT, "pred", `${m}.bmc-test1.raw.json`); if (!fs.existsSync(f)) return null; const t = read(f).timing; return Math.round(t.scanMs / t.words * 1000); };
  const baseSpeed = speed("base-q8");
  const rows = [];
  for (const f of fs.readdirSync(pdir).filter((x) => /-full(-ft)?\.json$/.test(x)).sort()) {
    const ft = /-full-ft\.json$/.test(f), key = f.replace(/-full(-ft)?\.json$/, ""), name = key + (ft ? "-ft" : "");
    if (name === "base-q8") continue; // today's model run again: the first row already shows it
    const s = safety(pdir, path.join(HERE, "noise-band.json"), f);
    const h = safety(path.join(PRIV, "product"), path.join(PRIV, "noise-band.json"), f);
    const j = junk(f);
    const g = (fin.includes(name) && F[name]) || G[name];
    const r = reg.get(key) || {};
    rows.push({ name, s, h, j, g, known: known[name], mb: r.bytes ? Math.round(r.bytes / 1e6) : null, speed: speed(name) });
  }
  const bs = safety(pdir, "", "base-q8-a.json"), bh = safety(path.join(PRIV, "product"), "", "base-q8-a.json");
  const L = [];
  L.push("| Model | Synthetic found / missed / leaked / fp | New leaks outside the band | Hers found / missed / leaked / fp | New leaks outside the band | 1. Safety | 2a. Held-out recall gain, untyped [interval] | 2b. Her model-only junk (today " + baseJunk.junk + ") | Known cases | MB | Node ms / 1k words |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  const tt = (t) => `${t.found} / ${t.missed} / ${t.leaked} / ${t.fp}`;
  L.push(`| base-q8 (today) | ${tt(bs.t)} | – | ${tt(bh.t)} | – | – | – | ${baseJunk.junk} | ${known["base-q8"] ? known["base-q8"].passed + "/" + known["base-q8"].cases : "–"} | 185 | ${baseSpeed ?? "–"} |`);
  for (const x of rows.sort((a, b) => (b.g ? b.g.u : -9) - (a.g ? a.g.u : -9))) {
    const safe = x.s.pass && x.h.pass ? "PASS" : "FAIL";
    const gain = x.g ? `${x.g.u >= 0 ? "+" : ""}${x.g.u.toFixed(3)} [${x.g.lo.toFixed(3)}, ${x.g.hi.toFixed(3)}] at ${x.g.level}%` : "–";
    const b2 = x.j.junk <= baseJunk.junk * 0.75 ? "PASS" : "FAIL";
    L.push(`| ${x.name} | ${tt(x.s.t)} | ${x.s.newBad} | ${tt(x.h.t)} | ${x.h.newBad} | ${safe} | ${gain} | ${x.j.junk} (${b2}) | ${x.known ? x.known.passed + "/" + x.known.cases : "–"} | ${x.mb ?? "–"} | ${x.speed ?? "–"} |`);
  }
  const md = L.join("\n") + "\n";
  fs.writeFileSync(path.join(OUT, "decision.md"), md);
  console.log(md);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e && e.stack || e); process.exitCode = 1; }
}
