/* Paired bootstrap intervals (PLAN.md 3.6).

   The caller says what a resampling unit is (a synthetic document, a Knesset UD newdoc, a
   block of 20 NEMO sentences) by the unit field on each document's counts; units are drawn
   with replacement, 2,000 times, from a seeded generator, so the same inputs give the same
   interval on every run and every machine (Math.random would not). Paired means one draw of
   units serves both models, so the interval of A-B reflects only how they differ on the same
   text. Percentile intervals; comparisons:k narrows alpha by Bonferroni (k=2 gives 97.5%). */
const { fscores } = require("./score-spans.js");

// mulberry32: small, fast, and well enough spread for resampling indices
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// metrics over summed counts (the fields score-spans.docCounts produces)
const METRICS = {
  p: (c) => fscores(c.tp, c.fp, c.fn).p,
  r: (c) => fscores(c.tp, c.fp, c.fn).r,
  f1: (c) => fscores(c.tp, c.fp, c.fn).f1,
  f2: (c) => fscores(c.tp, c.fp, c.fn).f2,
  entR: (c) => c.entN ? c.entFound / c.entN : 0,
  trapRate: (c) => c.trapN ? c.trapHit / c.trapN : 0,
  addedR: (c) => c.offN ? c.offTp / c.offN : 0,
};

const add = (acc, c, w) => { for (const k of Object.keys(c)) if (k !== "unit" && typeof c[k] === "number") acc[k] = (acc[k] || 0) + c[k] * w; return acc; };

/* perDoc (score().perDoc) -> units: documents summed by their unit id, in a fixed order so the
   draw does not depend on how the gold file happened to list them. */
function unitsOf(perDoc, unitOf) {
  const by = new Map();
  for (const [id, c] of Object.entries(perDoc)) {
    const u = String(unitOf ? unitOf(id, c) : (c.unit == null ? id : c.unit));
    by.set(u, add(by.get(u) || {}, c, 1));
  }
  return [...by.keys()].sort().map((id) => ({ id, counts: by.get(id) }));
}

// R's type 7 quantile: linear between order statistics
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const h = (sorted.length - 1) * q, lo = Math.floor(h);
  return sorted[lo] + (h - lo) * ((sorted[Math.min(lo + 1, sorted.length - 1)]) - sorted[lo]);
}

function settle(opt) {
  const o = Object.assign({ resamples: 2000, seed: 1, level: 0.95, comparisons: 1 }, opt || {});
  // a NaN seed or a zero count would give an interval that looks fine and means nothing
  if (!Number.isInteger(o.resamples) || o.resamples < 1) throw new Error("bootstrap: resamples must be a whole number of at least 1");
  if (!Number.isInteger(o.seed)) throw new Error("bootstrap: seed must be a whole number");
  if (!Number.isInteger(o.comparisons) || o.comparisons < 1) throw new Error("bootstrap: comparisons must be a whole number of at least 1");
  if (!(o.level > 0 && o.level < 1)) throw new Error("bootstrap: level must be between 0 and 1");
  o.alpha = (1 - o.level) / o.comparisons;
  o.levelUsed = 1 - o.alpha;
  return o;
}

// one resample's weights: how many times each unit was drawn
function draws(n, rng) {
  const w = new Array(n).fill(0);
  for (let i = 0; i < n; i++) w[Math.floor(rng() * n)]++;
  return w;
}

const total = (units, w) => units.reduce((acc, u, i) => (w ? (w[i] ? add(acc, u.counts, w[i]) : acc) : add(acc, u.counts, 1)), {});

function interval(vals, o) {
  const s = vals.slice().sort((x, y) => x - y);
  return [quantile(s, o.alpha / 2), quantile(s, 1 - o.alpha / 2)];
}

function ci(units, metric, opt) {
  const o = settle(opt), rng = mulberry32(o.seed), vals = [];
  for (let b = 0; b < o.resamples; b++) vals.push(metric(total(units, draws(units.length, rng))));
  return { est: metric(total(units)), ci: interval(vals, o), level: o.levelUsed, resamples: o.resamples, seed: o.seed, units: units.length };
}

/* A and B must cover the same units (the same documents, scored twice); a unit on one side only
   is a harness error, not something to skip quietly. diff is A-B: pass the candidate as A and
   the baseline as B, and an interval wholly above zero is a gain. */
function paired(unitsA, unitsB, metric, opt) {
  const o = settle(opt);
  const ib = new Map(unitsB.map((u) => [u.id, u]));
  if (unitsA.length !== unitsB.length || unitsA.some((u) => !ib.has(u.id))) throw new Error("paired bootstrap: A and B cover different units");
  const B = unitsA.map((u) => ib.get(u.id));
  const rng = mulberry32(o.seed), va = [], vb = [], vd = [];
  for (let b = 0; b < o.resamples; b++) {
    const w = draws(unitsA.length, rng);
    const a = metric(total(unitsA, w)), bb = metric(total(B, w));
    va.push(a); vb.push(bb); vd.push(a - bb);
  }
  const ea = metric(total(unitsA)), eb = metric(total(B));
  return { a: { est: ea, ci: interval(va, o) }, b: { est: eb, ci: interval(vb, o) },
    diff: { est: ea - eb, ci: interval(vd, o) }, level: o.levelUsed, resamples: o.resamples, seed: o.seed, units: unitsA.length };
}

module.exports = { mulberry32, METRICS, unitsOf, quantile, ci, paired };
