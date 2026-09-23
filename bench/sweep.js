/* Parameter sweep against the benchmark:
     node bench/sweep.js [--no-model] [--only=KEY] [--out=DIR]

   Several numbers in the detection layer were set by feel. Each one here is
   scored at several values on the whole corpus, model on, and the surface is
   written to sweep.md: leaks, misses, false positives, junk suggestions and
   run time at every point, with the shipped value marked. The engine is not
   edited; engine.js applies each variant as a textual patch and loads it
   fresh. A patch that no longer matches the source throws, so a stale sweep
   fails loudly rather than measuring the wrong thing.

   --only=KEY re-runs one parameter and replaces only its section; every other
   section of sweep.md, and every other parameter's rows in sweep.json, stay as
   they were. It used to rewrite the whole file with the one section, which is
   how a partial re-run cut sweep.md from thirteen sections to one (outside
   review, M13). Because sections can now come from different runs, each one
   says for itself whether the model was on, the commit and the date.
   --out=DIR writes there instead of bench/ (tests/sweep_t.js uses it).

   Junk (unlisted suggestions) is reported at every point and never used to
   pick a value: the list is read, accept-all is not how the tool is used. */
const fs = require("fs");
const path = require("path");

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3);
const NO_MODEL = process.argv.includes("--no-model");
const ONLY = arg("only");
const OUT = arg("out") || __dirname;

// the shipped source lines the sweep patches; each must match exactly once
const SRC = {
  min: 'const min=(opt&&opt.min)||0.6;',
  nearLen: 'const tg=targets.filter(t=>t.norm.length>=4).slice(0,120);',
  nearShort: 'if(t.words===1&&t.norm.length<=4&&',
  weak: 'const WEAK=new Set(["א","ה","ו","י"]);',
  homo: '[["א","ה"],["א","ע"],["ה","ע"],["א","י"],["כ","ח"],["ק","כ"],["ת","ט"],["ס","ש"],\n ["ב","ו"],["ז","צ"],["ו","י"],["ם","מ"],["ן","נ"],["ך","כ"],["ף","פ"],["ץ","צ"],\n ["ש","ס"],["ד","ת"],["ג","ק"],["ל","ר"],["ל","נ"],["נ","ר"],["מ","נ"],\n ["ב","פ"],["ד","ט"],["ג","כ"]].forEach(([a,b])=>{HOMO.add(a+b);HOMO.add(b+a)});',
  partMin: 'if(!p||p.length<2||STOP.has(p)||PLACE_BY[p]||AMBIG.has(p))return;',
  wordyLen: 'docTokAll.has("ה"+p)||p.length<=2;',
  sweepMin: 'if(v.length>=4&&!(v in sweep)&&rp&&!norm(rp).includes(v))sweep[v]={rep:rp,of:null};',
  shortSingle: 's.value.trim().split(/\\s+/).length===1 && s.value.trim().length<=3;',
  peelMin: 'if(PFX.has(f[0])&&f.length>=4){',
  discoverStem: 'if(PFX.has(st0[0])&&st0.length>=4&&st0[1]!=="ה"&&',
};
const HOMO_PAIRS = [["א","ה"],["א","ע"],["ה","ע"],["א","י"],["כ","ח"],["ק","כ"],["ת","ט"],["ס","ש"],["ב","ו"],["ז","צ"],["ו","י"],["ם","מ"],["ן","נ"],["ך","כ"],["ף","פ"],["ץ","צ"],["ש","ס"],["ד","ת"],["ג","ק"],["ל","ר"],["ל","נ"],["נ","ר"],["מ","נ"],["ב","פ"],["ד","ט"],["ג","כ"]];
const homoSrc = (pairs) => JSON.stringify(pairs) + ".forEach(([a,b])=>{HOMO.add(a+b);HOMO.add(b+a)});";

// each parameter: its points, each point a label, engine patches and/or option overrides
const PARAMS = [
  { key: "body", title: "verb layer (bodyNames) while the model runs", current: "on",
    points: [["off", [], { body: false }], ["on", [], { body: true }]] },
  { key: "min", title: "model confidence floor", current: "0.6",
    points: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v) => [String(v), [[SRC.min, `const min=(opt&&opt.min)||${v};`]]]) },
  { key: "nearLen", title: "near-miss scan: shortest target it looks for (letters)", current: "4",
    points: [3, 4, 5, 6].map((v) => [String(v), [[SRC.nearLen, `const tg=targets.filter(t=>t.norm.length>=${v}).slice(0,120);`]]]) },
  { key: "nearShort", title: "near-miss scan: single-word targets up to this length need a confusable pair or a weak letter", current: "4",
    points: [0, 3, 4, 5, 6, 99].map((v) => [v === 0 ? "off" : v === 99 ? "all" : String(v), [[SRC.nearShort, `if(t.words===1&&t.norm.length<=${v}&&`]]]) },
  { key: "weak", title: "matres lectionis: letters whose insertion or deletion counts as a typo", current: "א ה ו י",
    points: [["none", [[SRC.weak, 'const WEAK=new Set([]);']]], ["ו י", [[SRC.weak, 'const WEAK=new Set(["ו","י"]);']]], ["א ה ו י", [[SRC.weak, 'const WEAK=new Set(["א","ה","ו","י"]);']]], ["א ה ו י + geresh", [[SRC.weak, 'const WEAK=new Set(["א","ה","ו","י","\'"]);']]]] },
  { key: "homo", title: "confusable letter pairs (leave one out; 'none' = no pairs)", current: "all",
    points: [["all", [[SRC.homo, homoSrc(HOMO_PAIRS)]]], ["none", [[SRC.homo, homoSrc([])]]],
      ...HOMO_PAIRS.map((p) => ["without " + p.join("↔"), [[SRC.homo, homoSrc(HOMO_PAIRS.filter((q) => q !== p))]]])] },
  { key: "partMin", title: "sweep: shortest name part replaced on its own (letters)", current: "2",
    points: [2, 3, 4].map((v) => [String(v), [[SRC.partMin, `if(!p||p.length<${v}||STOP.has(p)||PLACE_BY[p]||AMBIG.has(p))return;`]]]) },
  { key: "wordyLen", title: "sweep: parts up to this length count as words (standalone only, review)", current: "2",
    points: [1, 2, 3].map((v) => [String(v), [[SRC.wordyLen, `docTokAll.has("ה"+p)||p.length<=${v};`]]]) },
  { key: "sweepMin", title: "sweep: shortest whole replaced value rescanned (letters)", current: "4",
    points: [3, 4, 5].map((v) => [String(v), [[SRC.sweepMin, `if(v.length>=${v}&&!(v in sweep)&&rp&&!norm(rp).includes(v))sweep[v]={rep:rp,of:null};`]]]) },
  { key: "shortSingle", title: "list rules: single-word names up to this length get prefixed forms only with review", current: "3",
    points: [0, 2, 3, 4].map((v) => [v === 0 ? "off" : String(v), [[SRC.shortSingle, `s.value.trim().split(/\\s+/).length===1 && s.value.trim().length<=${v};`]]]) },
  { key: "peelMin", title: "model output: shortest word whose first letter may be peeled as a prefix", current: "4",
    points: [3, 4, 5].map((v) => [String(v), [[SRC.peelMin, `if(PFX.has(f[0])&&f.length>=${v}){`]]]) },
  { key: "discoverStem", title: "discover: shortest prefixed word that hints at a first name", current: "4",
    points: [3, 4, 5].map((v) => [String(v), [[SRC.discoverStem, `if(PFX.has(st0[0])&&st0.length>=${v}&&st0[1]!=="ה"&&`]]]) },
  { key: "prefixes", title: "list rules: prefix-letter forms generated", current: "normal",
    points: [["off", [], { prefixes: "off" }], ["safe", [], { prefixes: "safe" }], ["normal", [], { prefixes: "normal" }]] },
];

const HEADER = ["# Parameter sweep", "",
  "Whole corpus at every point. Each section says whether the model was on, which commit it measured and when; " +
  "`--only` re-runs one section and keeps the rest, so sections can come from different runs. " +
  "The shipped value is marked ◀. Junk is reported, not optimised for.", ""];

// "## key — title" starts a section; everything before the first one is the header
function splitSections(md) {
  const out = new Map();
  let key = null, buf = [];
  const flush = () => { if (key !== null) out.set(key, buf.join("\n").replace(/\s+$/, "")); };
  for (const line of String(md || "").split(/\r?\n/)) {
    const m = /^## (\S+) — /.exec(line);
    if (m) { flush(); key = m[1]; buf = [line]; } else if (key !== null) buf.push(line);
  }
  flush();
  return out;
}

/* The new sweep.md: the sections just run replace their namesakes, every other
   section of the old file is kept. Order follows `order` (the PARAMS keys);
   a kept section whose key is no longer a parameter goes at the end rather
   than being dropped. */
function mergeSweep(oldMd, fresh, order) {
  const old = splitSections(oldMd), neu = splitSections(fresh);
  const keys = [...order.filter((k) => neu.has(k) || old.has(k)),
    ...[...old.keys(), ...neu.keys()].filter((k, i, a) => !order.includes(k) && a.indexOf(k) === i)];
  const body = keys.map((k) => (neu.has(k) ? neu.get(k) : old.get(k)));
  return [...HEADER, body.join("\n\n"), ""].join("\n");
}

// sweep.json: the re-run parameters' rows replace theirs, the rest are kept
function mergeRows(oldRows, freshRows) {
  const ran = new Set(freshRows.map((r) => r.param));
  return [...(oldRows || []).filter((r) => !ran.has(r.param)), ...freshRows];
}

function commit() {
  try {
    const r = require("child_process").spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: __dirname, encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : "unknown";
  } catch { return "unknown"; }
}

async function main() {
  const E = require("./engine.js");
  const { makeBench, loadModel, KEY } = require("./lib.js");
  if (ONLY && !PARAMS.some((P) => P.key === ONLY)) throw new Error(`--only=${ONLY}: no such parameter`);
  const pipe = NO_MODEL ? null : await loadModel();
  const results = [];
  const stamp = `Model ${NO_MODEL ? "off" : "on"}, ${KEY.docs.length} documents, commit ${commit()}, generated ${new Date().toISOString().slice(0, 10)}.`;
  const md = [];
  for (const P of PARAMS) {
    if (ONLY && P.key !== ONLY) continue;
    md.push(`## ${P.key} — ${P.title}`, "", stamp, "", "| value | leaks | missed | fp | junk | ms |", "|---|---|---|---|---|---|");
    for (const [label, patches, opt] of P.points) {
      const Ev = patches.length ? E.load(patches) : E;
      const B = makeBench(Ev, opt);
      const t0 = Date.now();
      const r = await B.runAll(pipe);
      const row = { param: P.key, value: label, ...r.totals, ms: Date.now() - t0, current: label === P.current, model: !NO_MODEL };
      results.push(row);
      md.push(`| ${label}${row.current ? " ◀" : ""} | ${row.leaked} | ${row.missed} | ${row.fp} | ${row.junk} | ${row.ms} |`);
      process.stderr.write(`${P.key}=${label}: leaks ${row.leaked} missed ${row.missed} fp ${row.fp} junk ${row.junk}\n`);
    }
    md.push("");
  }
  const mdFile = path.join(OUT, "sweep.md"), jsonFile = path.join(OUT, "sweep.json");
  const oldMd = fs.existsSync(mdFile) ? fs.readFileSync(mdFile, "utf8") : "";
  let oldRows = [];
  try { oldRows = JSON.parse(fs.readFileSync(jsonFile, "utf8")); } catch { oldRows = []; }
  const merged = mergeSweep(oldMd, md.join("\n"), PARAMS.map((P) => P.key));
  fs.writeFileSync(mdFile, merged);
  fs.writeFileSync(jsonFile, JSON.stringify(mergeRows(oldRows, results), null, 1));
  console.log(md.join("\n"));
}

module.exports = { mergeSweep, mergeRows, splitSections, PARAMS };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

