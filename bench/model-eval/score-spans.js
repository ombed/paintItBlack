/* Model-level span scoring (PLAN.md 3.1), from a gold set and a predictions file
   (shapes in docs/model-eval/FORMATS.md).

     node bench/model-eval/score-spans.js --gold=G.json --pred=P.json
          [--match=overlap-untyped] [--threshold=0] [--types=PER,ORG,PLACE]
          [--resamples=2000] [--seed=1] [--out=S.json]

   Three matchings:
     word-exact       both spans snapped to the whole words they touch, then equal, same type.
                      Snapping is what makes a Hebrew prefix letter count as part of the word:
                      "ולוי" is one word, so a span on "לוי" and one on "ולוי" snap alike.
     overlap-typed    one-to-one, any shared character, same type, largest overlap first.
     overlap-untyped  the same without the type.

   Gold mentions with must:false are negatives (traps, public bodies): they are not counted
   as gold, and a prediction on one is a false positive; the trap rate says how many were hit.
   A gold mention with offMissed:true is one the model-off pipeline misses; recall on those
   is the "added recall" (what the model is for). Empty sets score P=R=0, with n given so a
   zero from no data is not read as a zero from bad data. */
const fs = require("fs");

const TYPES = ["PER", "ORG", "PLACE"];
const MATCHES = ["word-exact", "overlap-typed", "overlap-untyped"];

// a word: letters (Hebrew with nikud, Latin, digits), joined across a geresh or quote inside
// it (צה"ל, ג'ורג'); maqaf, paseq and sof pasuq are separators, not letters
const W = "[\\u0591-\\u05bd\\u05bf\\u05c1\\u05c2\\u05c4\\u05c5\\u05c7\\u05d0-\\u05eaA-Za-z0-9\\u00c0-\\u024f]";
const J = "['\"\\u05f3\\u05f4\\u2019]";
const WORD_RX = new RegExp(`${W}+(?:${J}${W}+)*${J}?`, "g");

function wordsOf(text) {
  const ws = [], we = [];
  for (const m of String(text || "").matchAll(WORD_RX)) { ws.push(m.index); we.push(m.index + m[0].length); }
  return { ws, we };
}

// the span set to exactly the whole words it touches: grown over a cut word, and trimmed of a
// space or quote at an edge (a span on ' "דני' and one on 'דני' are the same words); a span on
// punctuation alone is left as it is
function snap(words, s, e) {
  const { ws, we } = words;
  let lo = 0, hi = ws.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (we[m] <= s) lo = m + 1; else hi = m; }
  if (lo >= ws.length || ws[lo] >= e) return [s, e];
  let j = lo;
  while (j + 1 < ws.length && ws[j + 1] < e) j++;
  return [ws[lo], we[j]];
}

const f = (tp, fp, fn, tpPred) => {
  const tpp = tpPred == null ? tp : tpPred;
  const p = tpp + fp ? tpp / (tpp + fp) : 0, r = tp + fn ? tp / (tp + fn) : 0;
  return { p, r, f1: p + r ? 2 * p * r / (p + r) : 0, f2: p + r ? 5 * p * r / (4 * p + r) : 0 };
};

function opts0(opt) {
  const o = Object.assign({ match: "overlap-untyped", threshold: 0, types: TYPES }, opt || {});
  if (!MATCHES.includes(o.match)) throw new Error("unknown match mode: " + o.match);
  // a misspelt type or a NaN cut-off would score nothing and look like a bad model
  if (!Array.isArray(o.types) || !o.types.length || o.types.some((t) => !TYPES.includes(t))) throw new Error("types must be a non-empty subset of " + TYPES.join(","));
  if (typeof o.threshold !== "number" || !(o.threshold >= 0 && o.threshold <= 1)) throw new Error("threshold must be a number from 0 to 1");
  o.typeSet = new Set(o.types);
  return o;
}

/* Harness errors, thrown rather than scored around: a type outside PER/ORG/PLACE (an unmapped
   label, FORMATS.md), offsets that are not a non-empty slice of the text, a score that is not a
   number, a document id given twice. Messages carry positions and numbers, never text. */
function checkSpans(list, what, k, len, scored) {
  list.forEach((x, i) => {
    const at = `${what} #${i} in document #${k}`;
    if (!TYPES.includes(x.type)) throw new Error(`harness error: ${at} has a type outside ${TYPES.join("/")}` + (/^[A-Z_-]{1,20}$/.test(String(x.type)) ? ` (${x.type})` : ""));
    if (!Number.isInteger(x.s) || !Number.isInteger(x.e) || x.s < 0 || x.e <= x.s || (len != null && x.e > len))
      throw new Error(`harness error: ${at} has offsets ${x.s}-${x.e} outside the text (length ${len})`);
    if (scored && x.score != null && !(typeof x.score === "number" && x.score >= 0 && x.score <= 1)) throw new Error(`harness error: ${at} has a score that is not a number from 0 to 1`);
  });
}
function checkIds(docs, what) {
  const seen = new Set();
  docs.forEach((d, k) => { if (seen.has(d.id)) throw new Error(`harness error: ${what} document #${k} repeats an id`); seen.add(d.id); });
}

// predictions at or above the cut-off; a span with no score (the cleaned stage) is always kept
const kept = (sp, o) => o.typeSet.has(sp.type) && (sp.score == null || sp.score >= o.threshold);
const sc1 = (p) => p.score == null ? 1 : p.score;

// one-to-one: every candidate pair, largest overlap first, then the higher score (so a
// low-scoring span cannot take a mention from a confident one and make it look wrong in the
// reliability table), then position, so the result does not depend on the order in the files
function pairUp(gold, preds, o, words) {
  const cand = [];
  const typed = o.match !== "overlap-untyped";
  const gs = o.match === "word-exact" ? gold.map((g) => snap(words, g.s, g.e)) : null;
  const ps = o.match === "word-exact" ? preds.map((p) => snap(words, p.s, p.e)) : null;
  gold.forEach((g, i) => preds.forEach((p, j) => {
    if (typed && g.type !== p.type) return;
    if (gs) {
      if (gs[i][0] === ps[j][0] && gs[i][1] === ps[j][1]) cand.push([gs[i][1] - gs[i][0], i, j]);
      return;
    }
    const ov = Math.min(g.e, p.e) - Math.max(g.s, p.s);
    if (ov > 0) cand.push([ov, i, j]);
  }));
  cand.sort((a, b) => b[0] - a[0] || sc1(preds[b[2]]) - sc1(preds[a[2]]) || gold[a[1]].s - gold[b[1]].s || preds[a[2]].s - preds[b[2]].s || a[1] - b[1] || a[2] - b[2]);
  const gm = new Array(gold.length).fill(-1), pm = new Array(preds.length).fill(-1);
  for (const [, i, j] of cand) if (gm[i] < 0 && pm[j] < 0) { gm[i] = j; pm[j] = i; }
  return { gm, pm };
}

/* The matching itself, per document: which gold mention each prediction took. score() and
   diff() summarise it; sweep.js reads it for the reliability table. */
function match(goldSet, predFile, opt) {
  const o = opts0(opt);
  const pdocs = (predFile && predFile.docs) || [];
  checkIds(goldSet.docs || [], "gold"); checkIds(pdocs, "predicted");
  const byId = new Map(pdocs.map((d) => [d.id, d]));
  const docs = [];
  (goldSet.docs || []).forEach((d, k) => {
    const len = typeof d.text === "string" ? d.text.length : null;
    checkSpans(d.mentions || [], "gold mention", k, len, false);
    const pd = byId.get(d.id);
    checkSpans((pd && pd.spans) || [], "predicted span", k, len, true);
    const all = (d.mentions || []).filter((m) => o.typeSet.has(m.type));
    const gold = all.filter((m) => m.must !== false), traps = all.filter((m) => m.must === false);
    // where two chunks overlap, the product returns one span twice (FORMATS.md): counted once, at its best score
    const best = new Map();
    for (const sp of ((pd && pd.spans) || []).filter((x) => kept(x, o))) {
      const key = sp.s + ":" + sp.e + ":" + sp.type, had = best.get(key);
      if (!had || (sp.score || 0) > (had.score || 0)) best.set(key, sp);
    }
    const preds = [...best.values()].sort((a, b) => a.s - b.s || a.e - b.e);
    const words = o.match === "word-exact" ? wordsOf(d.text) : null;
    const { gm, pm } = pairUp(gold, preds, o, words);
    // a trap is hit by any kept prediction that overlaps it, whatever its type
    const trapHit = traps.map((t) => preds.some((p) => Math.min(t.e, p.e) > Math.max(t.s, p.s)));
    const predOnTrap = preds.map((p) => traps.some((t) => Math.min(t.e, p.e) > Math.max(t.s, p.s)));
    docs.push({ id: d.id, unit: d.unit == null ? d.id : d.unit, missing: !pd, gold, traps, preds, gm, pm, trapHit, predOnTrap });
  });
  const goldIds = new Set((goldSet.docs || []).map((d) => d.id));
  const extraDocs = [...byId.keys()].filter((id) => !goldIds.has(id)).length;
  return { o, docs, extraDocs };
}

const entKey = (docId, m) => m.ent != null ? String(m.ent) : docId + "#" + m.s + "-" + m.e;
const bump = (obj, k, field, by) => { obj[k] = obj[k] || {}; obj[k][field] = (obj[k][field] || 0) + (by == null ? 1 : by); };

// the counts one document adds; bootstrap.js sums these per resampling unit
function docCounts(d) {
  const tp = d.gm.filter((j) => j >= 0).length;
  const ents = new Map();
  d.gold.forEach((g, i) => { const k = entKey(d.id, g); ents.set(k, (ents.get(k) || false) || d.gm[i] >= 0); });
  const off = d.gold.map((g, i) => [g, i]).filter(([g]) => g.offMissed);
  return {
    tp, fn: d.gold.length - tp, fp: d.pm.filter((i) => i < 0).length,
    entN: ents.size, entFound: [...ents.values()].filter(Boolean).length,
    trapN: d.traps.length, trapHit: d.trapHit.filter(Boolean).length,
    offN: off.length, offTp: off.filter(([, i]) => d.gm[i] >= 0).length,
  };
}

function score(goldSet, predFile, opt) {
  const M = match(goldSet, predFile, opt), o = M.o;
  const perDoc = {}, perType = {}, perCat = {}, trapCat = {};
  const tot = { tp: 0, fp: 0, fn: 0, entN: 0, entFound: 0, trapN: 0, trapHit: 0, offN: 0, offTp: 0 };
  let nPred = 0, trapPreds = 0;
  for (const t of o.types) perType[t] = { n: 0, np: 0, tp: 0, tpPred: 0, fp: 0, fn: 0 };
  for (const d of M.docs) {
    const c = docCounts(d);
    perDoc[d.id] = Object.assign({ unit: d.unit }, c);
    for (const k of Object.keys(tot)) tot[k] += c[k];
    nPred += d.preds.length;
    trapPreds += d.predOnTrap.filter(Boolean).length;
    d.gold.forEach((g, i) => {
      const T = perType[g.type]; T.n++; d.gm[i] >= 0 ? T.tp++ : T.fn++;
      if (g.cat != null) { bump(perCat, g.cat, "n"); bump(perCat, g.cat, "tp", d.gm[i] >= 0 ? 1 : 0); }
    });
    d.preds.forEach((p, j) => { const T = perType[p.type]; T.np++; d.pm[j] >= 0 ? T.tpPred++ : T.fp++; });
    d.traps.forEach((t, i) => { if (t.cat != null) { bump(trapCat, t.cat, "n"); bump(trapCat, t.cat, "hit", d.trapHit[i] ? 1 : 0); } });
  }
  for (const t of o.types) Object.assign(perType[t], f(perType[t].tp, perType[t].fp, perType[t].fn, perType[t].tpPred));
  for (const c of Object.values(perCat)) c.r = c.n ? c.tp / c.n : 0;
  for (const c of Object.values(trapCat)) c.rate = c.n ? c.hit / c.n : 0;
  const pf = predFile || {};
  return {
    model: pf.model == null ? null : pf.model, set: goldSet.name == null ? pf.set : goldSet.name,
    stage: pf.stage == null ? null : pf.stage, threshold: o.threshold, match: o.match, types: o.types.slice(),
    n: { docs: M.docs.length, gold: tot.tp + tot.fn, pred: nPred, traps: tot.trapN,
      missingDocs: M.docs.filter((d) => d.missing).length, extraDocs: M.extraDocs },
    micro: Object.assign({ tp: tot.tp, fp: tot.fp, fn: tot.fn }, f(tot.tp, tot.fp, tot.fn)),
    perType,
    entity: { n: tot.entN, found: tot.entFound, r: tot.entN ? tot.entFound / tot.entN : 0 },
    perCat,
    trap: { n: tot.trapN, hit: tot.trapHit, rate: tot.trapN ? tot.trapHit / tot.trapN : 0, preds: trapPreds, perCat: trapCat },
    added: { n: tot.offN, tp: tot.offTp, r: tot.offN ? tot.offTp / tot.offN : 0 },
    perDoc,
  };
}

/* Paired per-mention diff of two prediction files on one gold set (A is the baseline):
   found by both / only A (a loss for B) / only B (a gain) / neither. The same at entity level,
   since the section 1 rule speaks of entities. Items carry positions and ids only, never text. */
function diff(goldSet, predA, predB, opt) {
  const A = match(goldSet, predA, opt), B = match(goldSet, predB, opt);
  const cls = (a, b) => a && b ? "both" : a ? "onlyA" : b ? "onlyB" : "neither";
  const zero = () => ({ both: 0, onlyA: 0, onlyB: 0, neither: 0 });
  const mentions = zero(), entities = zero(), byCat = {}, byType = {}, items = [], ents = new Map();
  A.docs.forEach((da, k) => {
    const db = B.docs[k];
    da.gold.forEach((g, i) => {
      const a = da.gm[i] >= 0, b = db.gm[i] >= 0, c = cls(a, b);
      mentions[c]++;
      byType[g.type] = byType[g.type] || zero(); byType[g.type][c]++;
      if (g.cat != null) { byCat[g.cat] = byCat[g.cat] || zero(); byCat[g.cat][c]++; }
      items.push({ doc: da.id, s: g.s, e: g.e, type: g.type, cat: g.cat == null ? null : g.cat, ent: entKey(da.id, g), status: c });
      // per document, as score() counts entities, so the two never disagree on the total
      const key = da.id + "|" + entKey(da.id, g), prev = ents.get(key) || [false, false];
      ents.set(key, [prev[0] || a, prev[1] || b]);
    });
  });
  for (const [a, b] of ents.values()) entities[cls(a, b)]++;
  return { match: A.o.match, threshold: A.o.threshold, a: (predA && predA.model) || "A", b: (predB && predB.model) || "B",
    n: mentions.both + mentions.onlyA + mentions.onlyB + mentions.neither, mentions, entities, byType, byCat, items };
}

/* Command-line plumbing, shared with sweep.js (PLAN.md section 6).
   - A file that cannot be read or parsed is named by its argument, never quoted: Node's
     JSON.parse error repeats the start of the file, which for her gold is her text.
   - A run is private when --private is given, any path argument is under a private-bench
     folder, or the gold set says licence "private". A private run needs privacy.js: its
     console lines go through safeLog, a file written outside private-bench goes through
     safeWrite, and an error is printed only as privacy.sanitise leaves it. */
const PRIVATE_DIR = /(^|[\\/])private-bench([\\/]|$)/i;
const isPrivatePath = (p) => !!p && PRIVATE_DIR.test(require("path").resolve(p));

function cli(argv, body) {
  const arg = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  let privacy = null;
  try { privacy = require("./privacy.js"); } catch (_) { privacy = null; }
  let priv = argv.includes("--private") || ["gold", "pred", "out"].some((n) => isPrivatePath(arg(n)));
  const io = {
    arg,
    read(name) {
      const p = arg(name);
      if (!p) throw new Error(`--${name}= is required`);
      let txt;
      try { txt = fs.readFileSync(p, "utf8"); } catch (e) { throw new Error(`cannot read --${name} (${e.code || "error"})`); }
      let j;
      try { j = JSON.parse(txt); } catch (_) { throw new Error(`--${name} is not valid JSON`); }
      if (j && j.licence === "private") io.markPrivate();
      return j;
    },
    markPrivate() { priv = true; if (!privacy) throw new Error("a private run needs bench/model-eval/privacy.js; nothing written"); },
    get private() { return priv; },
    // fields: an object of numbers under allowlisted names; line: its public rendering
    log(fields, line) { if (priv) privacy.safeLog(fields); else console.log(line); },
    write(file, obj) {
      if (priv && !isPrivatePath(file)) return privacy.safeWrite(file, obj);
      fs.writeFileSync(file, JSON.stringify(obj, null, 1) + "\n");
      return file;
    },
  };
  try {
    if (priv && !privacy) throw new Error("a private run needs bench/model-eval/privacy.js; nothing written");
    if (priv) privacy.wrapErrors(() => body(io)); else body(io);
  } catch (err) {
    if (priv) console.error(privacy ? privacy.sanitise(err).stack : "failed (message withheld)");
    else console.error(err && err.stack || err);
    process.exitCode = 1;
  }
}

module.exports = { score, match, diff, snap, wordsOf, docCounts, fscores: f, cli, isPrivatePath, TYPES, MATCHES };

if (require.main === module) cli(process.argv.slice(2), (io) => {
  const gold = io.read("gold"), pred = io.read("pred");
  const opt = { match: io.arg("match", "overlap-untyped"), threshold: Number(io.arg("threshold", "0")),
    types: io.arg("types", TYPES.join(",")).split(",") };
  const S = score(gold, pred, opt);
  const B = require("./bootstrap.js");
  const units = B.unitsOf(S.perDoc);
  const bo = { resamples: Number(io.arg("resamples", "2000")), seed: Number(io.arg("seed", "1")) };
  S.ci95 = { r: B.ci(units, B.METRICS.r, bo).ci, f2: B.ci(units, B.METRICS.f2, bo).ci };
  const out = io.arg("out");
  // her scores outside private-bench: the FORMATS.md Scores shape only (no per-document rows),
  // which is also what the gate can read
  if (out) io.write(out, io.private && !isPrivatePath(out) ? { model: S.model, set: S.set, stage: S.stage, threshold: S.threshold, match: S.match,
    micro: S.micro, perType: Object.fromEntries(Object.entries(S.perType).map(([t, x]) => [t, { n: x.n, tp: x.tp, fp: x.fp, fn: x.fn, p: x.p, r: x.r, f1: x.f1, f2: x.f2 }])),
    ci95: S.ci95 } : S);
  const m = S.micro, r3 = (x) => x.toFixed(3);
  io.log({ tp: m.tp, fp: m.fp, fn: m.fn, p: +r3(m.p), r: +r3(m.r), f1: +r3(m.f1), f2: +r3(m.f2), ci95: S.ci95.r.map((x) => +r3(x)) },
    `tp ${m.tp} fp ${m.fp} fn ${m.fn}  P ${r3(m.p)} R ${r3(m.r)} F1 ${r3(m.f1)} F2 ${r3(m.f2)}  R95 [${S.ci95.r.map(r3).join(", ")}]`);
});
