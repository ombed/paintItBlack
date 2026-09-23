/* Model-eval scoring (bench/model-eval/score-spans.js, bootstrap.js, sweep.js, compare.js).

   Every expected number below was worked out by hand from the invented text, so a change to
   the matching, the F2 formula or the bootstrap shows up here before it moves a report. No
   model, no network, no private data. */
const S = require("../bench/model-eval/score-spans.js");
const B = require("../bench/model-eval/bootstrap.js");
const W = require("../bench/model-eval/sweep.js");
const C = require("../bench/model-eval/compare.js");
const privacy = require("../bench/model-eval/privacy.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const near = (a, b, m, eps) => ok(Math.abs(a - b) <= (eps || 1e-9), `${m}: ${a} vs ${b}`);
// a span on the n-th occurrence of a surface, so the offsets are not typed by hand
const at = (text, sub, n) => { let i = -1; for (let k = 0; k <= (n || 0); k++) i = text.indexOf(sub, i + 1); if (i < 0) throw new Error("fixture: missing " + sub); return { s: i, e: i + sub.length }; };
const M = (text, sub, type, extra, n) => Object.assign(at(text, sub, n), { type }, extra || {});
const P = (text, sub, type, score, n) => Object.assign(at(text, sub, n), { type, score });

// d1: a full name, a surname written with a prefix letter (gold leaves the letter out), a city
// behind two prefix letters, and a public body that must not be proposed
const T1 = "דני כהן הגיע ולוי אמר שבחיפה קר. משרד הבריאות הודיע.";
const g1 = {
  id: "d1", text: T1, mentions: [
    M(T1, "דני כהן", "PER", { must: true, cat: "P_HEB", ent: "d1#1" }),
    Object.assign(at(T1, "ולוי"), { type: "PER", must: true, cat: "P_HEB", ent: "d1#2" }),
    M(T1, "חיפה", "PLACE", { must: true, cat: "L_CITY", ent: "d1#3" }),
    M(T1, "משרד הבריאות", "ORG", { must: false, cat: "T_PUBLIC", ent: "d1#4" }),
  ],
};
g1.mentions[1].s += 1; // "לוי" without the ו
const p1 = [
  P(T1, "דני", "PER", 0.9),          // cut short: overlaps the full name, not word-exact
  P(T1, "ולוי", "PER", 0.7),         // with the prefix: word-exact after snapping
  P(T1, "שבחיפה", "ORG", 0.5),       // right place, wrong type
  P(T1, "משרד הבריאות", "ORG", 0.95), // the trap
  P(T1, "הגיע", "PER", 0.4),         // a verb read as a name
];
const gold1 = { name: "t1", docs: [g1] };
const pred1 = { model: "cand", set: "t1", stage: "raw", threshold: 0, docs: [{ id: "d1", spans: p1 }] };

console.log("\n— words and snapping —");
{
  const t = 'ראה את ג\'ורג\' וצה"ל, בן-גוריון';
  const w = S.wordsOf(t);
  const g = at(t, "ורג"), z = at(t, "צה");
  const sg = S.snap(w, g.s, g.e), sz = S.snap(w, z.s, z.e);
  ok(t.slice(sg[0], sg[1]) === "ג'ורג'", "a geresh inside and after a name keeps one word");
  ok(t.slice(sz[0], sz[1]) === 'וצה"ל', "gershayim join, and the prefix letter comes along");
  const b = at(t, "גוריון"), sb = S.snap(w, b.s, b.e);
  ok(t.slice(sb[0], sb[1]) === "גוריון", "a hyphen separates words");
  const c = at(t, ", "), sc = S.snap(w, c.s, c.e);
  ok(sc[0] === c.s && sc[1] === c.e, "a span on punctuation alone is left as it is");
}

console.log("\n— the three matchings on one document —");
{
  const ex = S.score(gold1, pred1, { match: "word-exact" });
  ok(ex.micro.tp === 1 && ex.micro.fp === 4 && ex.micro.fn === 2, `word-exact: 1/4/2, got ${ex.micro.tp}/${ex.micro.fp}/${ex.micro.fn}`);
  near(ex.micro.p, 0.2, "word-exact P"); near(ex.micro.r, 1 / 3, "word-exact R");
  near(ex.micro.f1, 0.25, "word-exact F1");
  near(ex.micro.f2, (5 * 0.2 * (1 / 3)) / (4 * 0.2 + 1 / 3), "word-exact F2 = 5PR/(4P+R)");

  const ty = S.score(gold1, pred1, { match: "overlap-typed" });
  ok(ty.micro.tp === 2 && ty.micro.fp === 3 && ty.micro.fn === 1, `overlap-typed: 2/3/1, got ${ty.micro.tp}/${ty.micro.fp}/${ty.micro.fn}`);
  near(ty.micro.p, 0.4, "overlap-typed P"); near(ty.micro.r, 2 / 3, "overlap-typed R");

  const un = S.score(gold1, pred1, { match: "overlap-untyped" });
  ok(un.micro.tp === 3 && un.micro.fp === 2 && un.micro.fn === 0, `overlap-untyped: 3/2/0, got ${un.micro.tp}/${un.micro.fp}/${un.micro.fn}`);
  near(un.micro.f2, 3 / 3.4, "overlap-untyped F2 (P .6, R 1)");
  ok(un.n.gold === 3 && un.n.traps === 1 && un.n.pred === 5, "the trap is not gold; counts n");

  const th = S.score(gold1, pred1, { match: "overlap-untyped", threshold: 0.6 });
  ok(th.micro.tp === 2 && th.micro.fp === 1 && th.micro.fn === 1, `cut-off 0.6 keeps .9/.7/.95: 2/1/1, got ${th.micro.tp}/${th.micro.fp}/${th.micro.fn}`);

  const rev = S.score(gold1, Object.assign({}, pred1, { docs: [{ id: "d1", spans: p1.slice().reverse() }] }), { match: "overlap-untyped" });
  ok(JSON.stringify(rev.micro) === JSON.stringify(un.micro), "the order of spans in the file does not matter");
}

console.log("\n— per type —");
{
  const ty = S.score(gold1, pred1, { match: "overlap-typed" });
  const per = ty.perType.PER, org = ty.perType.ORG, pl = ty.perType.PLACE;
  ok(per.n === 2 && per.np === 3 && per.tp === 2 && per.fp === 1, "typed PER: 2 gold, 3 predicted, 2 hit, 1 false");
  near(per.p, 2 / 3, "typed PER P"); near(per.r, 1, "typed PER R");
  ok(org.n === 0 && org.fp === 2 && org.p === 0 && org.r === 0, "typed ORG: nothing to find, two false, P=R=0");
  ok(pl.n === 1 && pl.fn === 1 && pl.np === 0 && pl.p === 0 && pl.r === 0, "typed PLACE: missed, nothing predicted");
  const un = S.score(gold1, pred1, { match: "overlap-untyped" });
  near(un.perType.PLACE.r, 1, "untyped: the place is found by an ORG span");
  near(un.perType.ORG.p, 0.5, "untyped ORG precision: one of its two spans matched something");
  const only = S.score(gold1, pred1, { match: "overlap-typed", types: ["PER"] });
  ok(only.micro.tp === 2 && only.micro.fp === 1 && only.micro.fn === 0 && only.n.traps === 0, "types:[PER] drops the other types from gold, predictions and traps");
}

console.log("\n— one-to-one, largest overlap first —");
{
  const t = "דני כהן אמר";
  const gold = { name: "g", docs: [{ id: "a", text: t, mentions: [M(t, "דני", "PER"), M(t, "כהן", "PER")] }] };
  const glued = { docs: [{ id: "a", spans: [P(t, "דני כהן", "PER", 0.9)] }] };
  const u = S.score(gold, glued, { match: "overlap-untyped" });
  ok(u.micro.tp === 1 && u.micro.fn === 1 && u.micro.fp === 0, "a glued span counts once under overlap");
  ok(S.score(gold, glued, { match: "word-exact" }).micro.tp === 0, "and not at all word-exact");
  // two predictions on one name: the larger overlap takes it, the other is false
  const two = { docs: [{ id: "a", spans: [{ s: 0, e: 2, type: "PER", score: 1 }, { s: 0, e: 3, type: "PER", score: 1 }] }] };
  const M2 = S.match(gold, two, { match: "overlap-untyped" });
  ok(M2.docs[0].gm[0] === 1 && M2.docs[0].pm[0] === -1, "the larger overlap wins the mention");
}

console.log("\n— entity recall, categories, added recall —");
const T2 = "רונית אמרה. אחר כך רונית שתקה. יוסי ישב.";
const g2 = { id: "d2", text: T2, mentions: [
  M(T2, "רונית", "PER", { must: true, cat: "P_HEB", ent: "d2#1", offMissed: true }, 0),
  M(T2, "רונית", "PER", { must: true, cat: "P_HEB", ent: "d2#1" }, 1),
  M(T2, "יוסי", "PER", { must: true, cat: "P_SHORT", ent: "d2#2", offMissed: true }),
] };
const gold2 = { name: "t2", docs: [g2] };
const predA = { model: "base", docs: [{ id: "d2", spans: [P(T2, "רונית", "PER", 0.8, 1)] }] };
const predB = { model: "cand", docs: [{ id: "d2", spans: [P(T2, "רונית", "PER", 0.8, 0), P(T2, "יוסי", "PER", 0.7)] }] };
{
  const s = S.score(gold2, predA, { match: "overlap-untyped" });
  near(s.micro.r, 1 / 3, "mention recall 1/3");
  ok(s.entity.n === 2 && s.entity.found === 1, "entity recall: one of two people, found through its second mention");
  near(s.entity.r, 0.5, "entity recall .5");
  ok(s.perCat.P_HEB.n === 2 && s.perCat.P_HEB.tp === 1 && s.perCat.P_SHORT.tp === 0, "recall per cat");
  ok(s.added.n === 2 && s.added.tp === 0 && s.added.r === 0, "added recall on the two offMissed mentions: 0/2");
  const sb = S.score(gold2, predB, { match: "overlap-untyped" });
  ok(sb.added.tp === 2 && sb.added.r === 1, "the candidate finds both offMissed mentions");
  ok(sb.perDoc.d2.entN === 2 && sb.perDoc.d2.entFound === 2, "per-document counts carry entities for the bootstrap");
}

console.log("\n— trap rate —");
{
  const s = S.score(gold1, pred1, { match: "overlap-untyped" });
  ok(s.trap.n === 1 && s.trap.hit === 1 && s.trap.rate === 1 && s.trap.preds === 1, "the public body was proposed: 1/1");
  ok(s.trap.perCat.T_PUBLIC.hit === 1, "trap hits per cat");
  const s2 = S.score(gold1, pred1, { match: "overlap-untyped", threshold: 0.96 });
  ok(s2.trap.hit === 0 && s2.trap.rate === 0, "above its score the trap is not hit");
}

console.log("\n— paired diff —");
{
  const d = S.diff(gold2, predA, predB, { match: "overlap-untyped" });
  ok(d.mentions.both === 0 && d.mentions.onlyA === 1 && d.mentions.onlyB === 2 && d.mentions.neither === 0, `mentions 0/1/2/0, got ${JSON.stringify(d.mentions)}`);
  ok(d.entities.both === 1 && d.entities.onlyB === 1 && d.entities.onlyA === 0, "entities: the person both find (by different mentions), and one only B finds");
  ok(d.byCat.P_HEB.onlyA === 1 && d.byCat.P_HEB.onlyB === 1 && d.byCat.P_SHORT.onlyB === 1, "by cat");
  ok(d.items.every((x) => !("text" in x)) && d.items.length === 3, "items carry positions, never text");
  const same = S.diff(gold1, pred1, pred1);
  ok(same.mentions.onlyA === 0 && same.mentions.onlyB === 0, "a file against itself: no losses, no gains");
}

console.log("\n— empty sets —");
{
  const e = S.score({ name: "e", docs: [] }, { docs: [] });
  ok(e.micro.p === 0 && e.micro.r === 0 && e.micro.f2 === 0 && e.n.gold === 0 && e.n.pred === 0, "no gold, no predictions: zeros, with n=0");
  const miss = S.score(gold1, { docs: [] });
  ok(miss.micro.r === 0 && miss.micro.p === 0 && miss.micro.fn === 3 && miss.n.missingDocs === 1, "a document with no prediction entry counts as missing");
  const extra = S.score({ name: "e", docs: [] }, pred1);
  ok(extra.n.extraDocs === 1 && extra.micro.fp === 0, "a predicted document not in the gold is counted, not scored");
  let threw = false; try { S.score(gold1, pred1, { match: "fuzzy" }); } catch (_) { threw = true; }
  ok(threw, "an unknown matching is an error");
}

console.log("\n— bootstrap —");
{
  const r = B.mulberry32(1);
  const xs = Array.from({ length: 1000 }, r);
  ok(xs.every((x) => x >= 0 && x < 1), "mulberry32 stays in [0,1)");
  ok(B.mulberry32(7)() === B.mulberry32(7)() && B.mulberry32(7)() !== B.mulberry32(8)(), "seeded: same seed, same stream");

  // 100 documents, half with their one mention found: R .5, and the 95% interval near ±1.96·sqrt(.25/100)
  const units = Array.from({ length: 100 }, (_, i) => ({ id: "u" + String(i).padStart(3, "0"), counts: { tp: i % 2, fn: 1 - (i % 2), fp: 0 } }));
  const c1 = B.ci(units, B.METRICS.r), c2 = B.ci(units, B.METRICS.r);
  ok(JSON.stringify(c1) === JSON.stringify(c2), "same seed, same interval");
  // 100 binary units give a coarse interval that two seeds can share; uneven units do not
  const uneven = units.map((u, i) => ({ id: u.id, counts: { tp: i % 7, fn: i % 3, fp: 0 } }));
  const u1 = B.ci(uneven, B.METRICS.r), u3 = B.ci(uneven, B.METRICS.r, { seed: 2 });
  ok(u3.ci[0] !== u1.ci[0] || u3.ci[1] !== u1.ci[1], "another seed, another draw");
  near(c1.est, 0.5, "point estimate");
  ok(c1.ci[0] > 0.38 && c1.ci[0] < 0.42 && c1.ci[1] > 0.58 && c1.ci[1] < 0.62, `95% interval about [.40, .60]: ${c1.ci}`);
  ok(c1.resamples === 2000 && c1.level === 0.95, "2,000 resamples at 95% by default");

  const flat = units.map((u) => ({ id: u.id, counts: { tp: 1, fn: 1, fp: 0 } }));
  const cf = B.ci(flat, B.METRICS.r);
  ok(cf.ci[0] === 0.5 && cf.ci[1] === 0.5, "identical units: an interval of width zero");

  const same = B.paired(units, units, B.METRICS.r);
  ok(same.diff.est === 0 && same.diff.ci[0] === 0 && same.diff.ci[1] === 0, "A against itself: difference exactly 0");
  const better = units.map((u) => ({ id: u.id, counts: { tp: 1, fn: 0, fp: 0 } }));
  const pd = B.paired(better, units, B.METRICS.r);
  near(pd.diff.est, 0.5, "A-B point estimate");
  ok(pd.diff.ci[0] > 0.38 && pd.diff.ci[1] < 0.62, "A-B interval, paired: " + pd.diff.ci);
  const bon = B.paired(better, units, B.METRICS.r, { comparisons: 2 });
  ok(Math.abs(bon.level - 0.975) < 1e-12, "Bonferroni for two finalists: 97.5%");
  ok(bon.diff.ci[0] <= pd.diff.ci[0] && bon.diff.ci[1] >= pd.diff.ci[1], "and a wider interval");
  let threw = false; try { B.paired(units, units.slice(1), B.METRICS.r); } catch (_) { threw = true; }
  ok(threw, "A and B over different units is an error");

  // documents summed into units given by the caller
  const us = B.unitsOf({ a: { unit: "k1", tp: 1, fn: 0, fp: 2 }, b: { unit: "k1", tp: 0, fn: 1, fp: 0 }, c: { unit: "k2", tp: 1, fn: 1, fp: 0 } });
  ok(us.length === 2 && us[0].id === "k1" && us[0].counts.tp === 1 && us[0].counts.fn === 1 && us[0].counts.fp === 2, "unitsOf sums documents per unit");
  near(B.quantile([0, 10], 0.25), 2.5, "quantile interpolates");
}

console.log("\n— sweep —");
{
  // two names; four predictions: right .92, wrong .72, right .52, wrong .32
  const t = "אבי שר. גל רץ. דן בא. רון הלך.";
  const gold = { name: "sw", split: "tune", docs: [{ id: "s1", text: t, mentions: [M(t, "אבי", "PER"), M(t, "דן", "PER")] }] };
  const pred = { model: "x", docs: [{ id: "s1", spans: [P(t, "אבי", "PER", 0.92), P(t, "גל", "PER", 0.72), P(t, "דן", "PER", 0.52), P(t, "רון", "PER", 0.32)] }] };
  const s = W.sweep(gold, pred, { match: "overlap-untyped" });
  ok(s.points.length === 14 && s.points[0].t === 0.3 && s.points[13].t === 0.95, "14 cut-offs from .30 to .95");
  ok(s.points.some((p) => p.t === 0.6), "0.6 is on the grid exactly");
  const pt = (x) => s.points.find((p) => p.t === x);
  near(pt(0.3).f2, 2.5 / 3, "at .30: P .5, R 1");
  near(pt(0.35).f2, 10 / 11, "at .35: P 2/3, R 1");
  near(pt(0.6).f2, 0.5, "at .60: P .5, R .5");
  near(pt(0.8).f2, 2.5 / 4.5, "at .80: P 1, R .5");
  ok(pt(0.95).tp === 0 && pt(0.95).f2 === 0, "at .95 nothing is kept");
  ok(s.best.t === 0.35 && Math.abs(s.best.f2 - 10 / 11) < 1e-12, `best F2 at .35 (tied .35-.50, lower wins): ${s.best.t}`);
  near(s.ap, 0.5 * 1 + 0.5 * (2 / 3), "AP over the grid: .5·1 + .5·2/3");
  const rel = W.reliability(gold, pred, { match: "overlap-untyped" });
  const band = (b) => rel.bands.find((x) => x.band === b);
  ok(band("<.6").n === 2 && band("<.6").correct === 1, "reliability <.6: 1 of 2");
  ok(band(".6-.8").n === 1 && band(".6-.8").correct === 0, "reliability .6-.8: 0 of 1");
  ok(band(".8-.95").n === 1 && band(".8-.95").correct === 1, "reliability .8-.95: 1 of 1");
  ok(band(">=.95").n === 0 && band(">=.95").share === 0, "reliability >=.95: empty");
  const none = W.sweep(gold, pred, { split: "test" });
  ok(none.docs === 0 && none.points.every((p) => p.f2 === 0), "a split with no documents sweeps to zeros");
  const mixed = { name: "m", docs: [Object.assign({ split: "tune" }, gold.docs[0]), { id: "s2", split: "test", text: t, mentions: [M(t, "רון", "PER")] }] };
  ok(W.sweep(mixed, pred, { split: "tune" }).docs === 1, "a document's own split selects it");
}

console.log("\n— compare —");
{
  // a held-out set of 30 small documents: the candidate finds one more name in every tenth
  const docs = [], base = [], cand = [];
  for (let i = 0; i < 30; i++) {
    const t = "דני אמר. רון בא.";
    docs.push({ id: "p" + i, text: t, mentions: [M(t, "דני", "PER"), M(t, "רון", "PER")] });
    base.push({ id: "p" + i, spans: [P(t, "דני", "PER", 0.9)] });
    cand.push({ id: "p" + i, spans: [P(t, "דני", "PER", 0.9)].concat(i % 10 === 0 ? [P(t, "רון", "PER", 0.8)] : []) });
  }
  const inp = { golds: [{ name: "protocol", licence: "public", docs }],
    preds: [{ model: "base-q8", set: "protocol", stage: "raw", docs: base, health: { unmappedLabels: 0, chunksOver510: 0, chunkErrors: 0 } },
      { model: "tiny-parse", set: "protocol", stage: "raw", docs: cand, health: { unmappedLabels: 0, chunksOver510: 0, chunkErrors: 0 } }],
    scores: [] };
  const md = C.compare(inp, { finalists: ["tiny-parse"], registry: [{ key: "tiny-parse", bytes: 45e6, licence: "CC-BY-4.0", shippable: true }], resamples: 500 });
  ok(/## 1\. The rule/.test(md) && /\| 4\. Licence \| PASS \|/.test(md), "section 1 has the rule table; licence passes from the registry");
  ok(/\| 5\. Browser = Node \| PENDING \|/.test(md) && /\| 1\. No new leaks \| PENDING \|/.test(md), "rules without inputs are PENDING, not passed");
  ok(/\| \*\*Verdict\*\* \| \*\*PENDING\*\* \|/.test(md), "so the verdict is PENDING");
  ok(/## protocol \(held out\)/.test(md) && /\| tiny-parse \| raw \| 0\.60 untuned \|/.test(md), "a per-set table, with the untuned cut-off marked");
  const M1 = C.build(inp, { finalists: ["tiny-parse"], resamples: 500 });
  ok(M1.rules["tiny-parse"].r2a.st === "PASS" || M1.rules["tiny-parse"].r2a.st === "FAIL", "rule 2a is decided for a finalist");
  near(M1.rules["tiny-parse"].pooled.u.diff.est, 3 / 60, "pooled untyped recall gain: 3 names in 60");
  const M2 = C.build(inp, { resamples: 500 });
  ok(M2.rules["tiny-parse"].r2a.st === "n/a", "not a finalist: 2a is not tested");
  const big = C.build(inp, { registry: [{ key: "tiny-parse", bytes: 500e6, licence: "none", shippable: false }], resamples: 200 });
  ok(big.rules["tiny-parse"].r3.st === "FAIL" && big.rules["tiny-parse"].r4.st === "FAIL" && big.rules["tiny-parse"].verdict === "FAIL", "a red download and no licence fail");

  // alignment losses: one the baseline shares is the engine's; one beyond it is this row's harness
  const withLoss = (bl, cl) => ({ golds: inp.golds, scores: [], preds: [
    { model: "base-q8", set: "protocol", stage: "raw", docs: base, health: { unmappedLabels: 0, chunksOver510: 0, chunkErrors: 0, alignFailEntityTokens: bl, entityTokens: 1000 } },
    { model: "tiny-parse", set: "protocol", stage: "raw", docs: cand, health: { unmappedLabels: 0, chunksOver510: 0, chunkErrors: 0, alignFailEntityTokens: cl, entityTokens: 1000 } }] });
  const shared = C.build(withLoss(19, 19), { resamples: 100 }).rules["tiny-parse"].health;
  ok(shared.st === "PASS" && /share the baseline/.test(shared.why), "a 1.9% loss the baseline has too passes, and is named: " + shared.why);
  const worse = C.build(withLoss(19, 30), { resamples: 100 }).rules["tiny-parse"].health;
  ok(worse.st === "FAIL", "1.1 points beyond the baseline's loss fails: " + worse.why);
  const alone = C.build(withLoss(0, 6), { resamples: 100 }).rules["tiny-parse"].health;
  ok(alone.st === "FAIL", "0.6% where the baseline loses nothing fails");

  // private: counts per category only, through the real privacy gate
  const T = "דני כהן אמר. רון בא.";
  const pdocs = [{ id: "r9-interview-2026-01-01", text: T, mentions: [M(T, "דני כהן", "PER", { must: true, cat: "P_HEB", ent: "a" }), M(T, "רון", "PER", { must: false, cat: "T_PLONI", ent: "b" })] }];
  const pinp = { golds: [{ name: "private", licence: "private", docs: pdocs }],
    preds: [{ model: "base-q8", set: "private", stage: "raw", docs: [{ id: pdocs[0].id, spans: [P(T, "דני", "PER", 0.9)] }] },
      { model: "tiny-parse", set: "private", stage: "raw", docs: [{ id: pdocs[0].id, spans: [P(T, "רון", "PER", 0.9)] }] }],
    scores: [] };
  const pmd = C.compare(pinp, { private: true, privacy });
  ok(!/[֐-׿]/.test(pmd) && !pmd.includes("r9-interview"), "private report: no Hebrew, no document ids");
  ok(/\| P_HEB \|/.test(pmd) && /\| T_PLONI \|/.test(pmd), "private report: category rows");
  let threw = false; try { C.compare(pinp, { private: true }); } catch (_) { threw = true; }
  ok(threw, "private without the gate refuses to render");
  threw = false; try { C.compare({ golds: [Object.assign({}, pinp.golds[0], { name: "Rachel" })], preds: pinp.preds.map((p) => Object.assign({}, p, { set: "Rachel" })), scores: [] }, { private: true, privacy }); } catch (e) { threw = e instanceof privacy.PrivacyError; }
  ok(threw, "a set name the gate does not know stops the private report");
}

console.log("\n— review: harness errors are thrown, not scored around —");
{
  const throws = (fn, m) => { let t = false; try { fn(); } catch (_) { t = true; } ok(t, m); };
  const t = "דני כהן אמר";
  const g = { name: "g", docs: [{ id: "a", text: t, mentions: [M(t, "דני", "PER")] }] };
  const one = (sp) => ({ docs: [{ id: "a", spans: [sp] }] });
  throws(() => S.score(g, one({ s: 0, e: 3, type: "GPE", score: 1 })), "an unmapped prediction type (GPE) is an error, not a silent drop");
  throws(() => S.score({ name: "g", docs: [{ id: "a", text: t, mentions: [{ s: 0, e: 3, type: "MISC" }] }] }, one({ s: 0, e: 3, type: "PER", score: 1 })), "a gold type outside PER/ORG/PLACE is an error");
  throws(() => S.score(g, one({ s: 0, e: 99, type: "PER", score: 1 })), "a span past the end of the text is an error");
  throws(() => S.score(g, one({ s: 3, e: 3, type: "PER", score: 1 })), "an empty span is an error");
  throws(() => S.score(g, one({ s: 0.5, e: 3, type: "PER", score: 1 })), "a fractional offset is an error");
  throws(() => S.score(g, one({ s: 0, e: 3, type: "PER", score: "high" })), "a score that is not a number is an error");
  throws(() => S.score({ name: "g", docs: [g.docs[0], g.docs[0]] }, one({ s: 0, e: 3, type: "PER", score: 1 })), "a repeated gold document id is an error");
  throws(() => S.score(g, { docs: [{ id: "a", spans: [] }, { id: "a", spans: [] }] }), "a repeated predicted document id is an error");
  throws(() => S.score(g, one({ s: 0, e: 3, type: "PER", score: 1 }), { types: ["PERS"] }), "a misspelt type option is an error");
  throws(() => S.score(g, one({ s: 0, e: 3, type: "PER", score: 1 }), { threshold: NaN }), "a NaN cut-off is an error");
  let msg = ""; try { S.score(g, one({ s: 0, e: 3, type: "שם", score: 1 })); } catch (e) { msg = e.message; }
  ok(msg && !/[֐-׿]/.test(msg), "the error names the position, never the text of the type");
}

console.log("\n— review: word-exact trims edges to the words —");
{
  const t = 'אמר "דני" ולוי.';
  const g = { name: "g", docs: [{ id: "a", text: t, mentions: [M(t, "דני", "PER"), Object.assign(at(t, "לוי"), { type: "PER" })] }] };
  const s0 = at(t, '"דני"'), s1 = at(t, " ולוי.");
  const p = { docs: [{ id: "a", spans: [{ s: s0.s - 1, e: s0.e, type: "PER", score: 1 }, { s: s1.s, e: s1.e, type: "PER", score: 1 }] }] };
  const r = S.score(g, p, { match: "word-exact" });
  ok(r.micro.tp === 2 && r.micro.fp === 0, `a leading space, quotes and a full stop do not break word-exact: ${r.micro.tp}/${r.micro.fp}`);
  const glued = { docs: [{ id: "a", spans: [{ s: s0.s, e: s1.e - 1, type: "PER", score: 1 }] }] };
  ok(S.score(g, glued, { match: "word-exact" }).micro.tp === 0, "a span over two names is still not word-exact with either");
}

console.log("\n— review: equal overlaps go to the higher score —");
{
  const t = "דני כהן אמר";
  const g = { name: "g", docs: [{ id: "a", text: t, mentions: [M(t, "דני כהן", "PER")] }] };
  const p = { docs: [{ id: "a", spans: [P(t, "דני", "PER", 0.4), P(t, "כהן", "PER", 0.97)] }] };
  const m = S.match(g, p, { match: "overlap-untyped" });
  ok(m.docs[0].gm[0] === 1, "the confident half takes the mention, the other is the false one");
  const rel = W.reliability(g, p);
  ok(rel.bands.find((b) => b.band === ">=.95").correct === 1 && rel.bands.find((b) => b.band === "<.6").correct === 0, "so the reliability table credits the confident span");
  const rev = S.match(g, { docs: [{ id: "a", spans: p.docs[0].spans.slice().reverse() }] }, { match: "overlap-untyped" });
  ok(rev.docs[0].preds[rev.docs[0].gm[0]].score === 0.97, "whatever the order in the file");
}

console.log("\n— review: sweep and bootstrap inputs —");
{
  const t = "דני אמר";
  const g = { name: "g", docs: [{ id: "a", text: t, mentions: [M(t, "דני", "PER")] }] };
  let th = false; try { W.sweep(g, { docs: [{ id: "a", spans: [{ s: 0, e: 3, type: "PER" }] }] }); } catch (_) { th = true; }
  ok(th, "a sweep over spans with no score is an error (they would be kept at every cut-off)");
  th = false; try { W.reliability(g, { docs: [{ id: "a", spans: [{ s: 0, e: 3, type: "PER", score: -0.1 }] }] }); } catch (_) { th = true; }
  ok(th, "a negative score is an error, not a crash or a silent drop");
  const units = Array.from({ length: 12 }, (_, i) => ({ id: "u" + i, counts: { tp: i % 4, fn: i % 3, fp: 0 } }));
  for (const bad of [{ seed: NaN }, { seed: 1.5 }, { resamples: 0 }, { comparisons: 0 }, { level: 1 }]) {
    th = false; try { B.ci(units, B.METRICS.r, bad); } catch (_) { th = true; }
    ok(th, "bootstrap refuses " + JSON.stringify(bad));
  }
  const other = units.map((u) => ({ id: u.id, counts: { tp: 1, fn: 1, fp: 0 } }));
  const a = B.paired(units, other, B.METRICS.r, { resamples: 300 });
  const b = B.paired(units, other.slice().reverse(), B.METRICS.r, { resamples: 300 });
  ok(JSON.stringify(a) === JSON.stringify(b), "paired: B listed in another order gives the same interval");
  const s1 = B.unitsOf({ x: { tp: 1, fn: 0, fp: 0 }, y: { tp: 0, fn: 1, fp: 0 } }), s2 = B.unitsOf({ y: { tp: 0, fn: 1, fp: 0 }, x: { tp: 1, fn: 0, fp: 0 } });
  ok(JSON.stringify(B.ci(s1, B.METRICS.r, { resamples: 300 })) === JSON.stringify(B.ci(s2, B.METRICS.r, { resamples: 300 })), "the gold file's document order does not change the interval");
}

console.log("\n— review: rule 2a decided by the numbers —");
{
  const mk = (name, n, candFinds) => {
    const docs = [], base = [], cand = [];
    for (let i = 0; i < n; i++) {
      const t = "דני אמר. רון בא.";
      docs.push({ id: name + i, text: t, mentions: [M(t, "דני", "PER"), M(t, "רון", "PER")] });
      base.push({ id: name + i, spans: [P(t, "דני", "PER", 0.9)] });
      cand.push({ id: name + i, spans: candFinds(t, i) });
    }
    return { gold: { name, licence: "public", docs }, base: { model: "base-q8", set: name, stage: "raw", docs: base }, cand: { model: "tiny-parse", set: name, stage: "raw", docs: cand } };
  };
  const both = (t) => [P(t, "דני", "PER", 0.9), P(t, "רון", "PER", 0.9)];
  const inpOf = (...xs) => ({ golds: xs.map((x) => x.gold), preds: xs.flatMap((x) => [x.base, x.cand]), scores: [] });
  const win = C.build(inpOf(mk("protocol", 20, both)), { finalists: ["tiny-parse"], resamples: 300 });
  ok(win.rules["tiny-parse"].r2a.st === "PASS", "a gain in every document passes 2a");
  // 3 gains in 30 documents: about 4% of draws hold none of them, more than the 1.25% tail, so the interval touches 0
  const thin = mk("protocol", 30, (t, i) => [P(t, "דני", "PER", 0.9)].concat(i % 10 === 0 ? [P(t, "רון", "PER", 0.8)] : []));
  const r = C.build(inpOf(thin), { finalists: ["tiny-parse", "joint-base"], resamples: 500 }).rules["tiny-parse"];
  ok(r.r2a.st === "FAIL" && r.pooled.u.diff.ci[0] <= 0, "a thin gain is not wholly above zero at 97.5%: FAIL");
  ok(Math.abs(r.pooled.u.diff.est - 3 / 60) < 1e-12, "its point estimate is still 3 in 60");
  const worse = C.build(inpOf(mk("protocol", 20, both), mk("knesset-ud", 20, () => [])), { finalists: ["tiny-parse"], resamples: 300 }).rules["tiny-parse"];
  ok(worse.r2a.st === "FAIL" && /knesset-ud/.test(worse.r2a.why), "one held-out set significantly worse fails 2a even with a pooled gain");
  ok(worse.r2b.st === "FAIL", "and fails 2b's recall condition");
  // two sets each a little worse, neither significant alone (1 loss in 12), clearly worse pooled
  const lossy = (t, i) => i % 12 === 0 ? [] : [P(t, "דני", "PER", 0.9)];
  const pooledNeg = C.build(inpOf(mk("protocol", 12, lossy), mk("knesset-ud", 12, lossy), mk("nemo-test", 12, lossy), mk("bmc-test1", 12, lossy)), { resamples: 300 }).rules["tiny-parse"];
  ok(pooledNeg.r2b.st === "FAIL" && /pooled/.test(pooledNeg.r2b.why) && !/protocol/.test(pooledNeg.r2b.why), "2b fails on a pooled recall loss that no single set shows");
  const three = C.build(inpOf(mk("protocol", 5, both)), { finalists: ["a", "b", "c"], resamples: 50 });
  ok(Math.abs(three.level - (1 - 0.05 / 3)) < 1e-12, "three finalists: Bonferroni over three, not capped at two");
}

console.log("\n— review: compare never lets her sets into the public report —");
{
  const fs = require("fs"), os = require("os"), path = require("path");
  const T = "דני אמר.";
  const g = { name: "private", licence: "private", docs: [{ id: "r9-interview-2026-01-01", text: T, mentions: [M(T, "דני", "PER", { must: true, cat: "P_HEB", ent: "a" })] }] };
  const pr = { model: "base-q8", set: "private", stage: "raw", docs: [{ id: g.docs[0].id, spans: [P(T, "דני", "PER", 0.9)] }] };
  let th = false; try { C.compare({ golds: [g], preds: [pr], scores: [] }, {}); } catch (_) { th = true; }
  ok(th, "a gold set with licence private is refused without --private");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-score-"));
  try {
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify({ name: "protocol", licence: "public", docs: [{ id: "x", text: "אבי", mentions: [{ s: 0, e: 3, type: "PER" }] }] }));
    fs.writeFileSync(path.join(dir, "a.json"), '{"docs": [ broken דני כהן');
    const inp = C.load([dir]);
    ok(inp.unreadable === 1 && inp.golds.length === 1, "an unparseable file is counted, not dropped quietly");
    const md = C.compare(Object.assign(inp, { preds: [{ model: "base-q8", set: "protocol", stage: "raw", docs: [{ id: "x", spans: [] }] }] }), { resamples: 50 });
    ok(/1 JSON file\(s\) .* could not be parsed/.test(md) && !/broken/.test(md), "the report says so without quoting it");

    // the command-line tools on a file that does not parse: its text never reaches the console
    const cp = require("child_process");
    const run = (script, args) => cp.spawnSync(process.execPath, [path.join(__dirname, "..", "bench", "model-eval", script)].concat(args), { encoding: "utf8" });
    const pdir = path.join(dir, "private-bench");
    fs.mkdirSync(pdir);
    const bad = path.join(pdir, "gold.json");
    fs.writeFileSync(bad, '{"name": "private", "docs": [ דני כהן secret');
    for (const script of ["score-spans.js", "sweep.js"]) {
      for (const f of [bad, path.join(dir, "a.json")]) {
        const r = run(script, ["--gold=" + f, "--pred=" + f]);
        ok(r.status === 1 && !/[֐-׿]|secret|broken/.test(r.stdout + r.stderr), `${script}: a bad file fails without quoting it (${f === bad ? "private" : "public"} path)`);
      }
    }
    // a private run: numbers-only console, and a score file outside private-bench only through the gate
    fs.writeFileSync(path.join(pdir, "g.json"), JSON.stringify(g));
    fs.writeFileSync(path.join(pdir, "p.json"), JSON.stringify(pr));
    const outside = path.join(dir, "s.json");
    const r = run("score-spans.js", ["--gold=" + path.join(pdir, "g.json"), "--pred=" + path.join(pdir, "p.json"), "--out=" + outside, "--resamples=50"]);
    ok(r.status === 0 && /^\{"tp":1,"fp":0,"fn":0/.test(r.stdout) && !/[֐-׿]/.test(r.stdout + r.stderr), "private score run: allowlisted numbers on the console");
    ok(fs.existsSync(outside) && !/[֐-׿]/.test(fs.readFileSync(outside, "utf8")), "and the score file outside private-bench passed the gate");
    const g2 = JSON.parse(JSON.stringify(g)); g2.docs[0].id = "note-for-dani";
    const p2 = JSON.parse(JSON.stringify(pr)); p2.docs[0].id = "note-for-dani";
    fs.writeFileSync(path.join(pdir, "g2.json"), JSON.stringify(g2)); fs.writeFileSync(path.join(pdir, "p2.json"), JSON.stringify(p2));
    const out2 = path.join(dir, "s2.json");
    const r2 = run("score-spans.js", ["--gold=" + path.join(pdir, "g2.json"), "--pred=" + path.join(pdir, "p2.json"), "--out=" + out2, "--resamples=50"]);
    ok(r2.status === 0 && fs.existsSync(out2) && !/dani|perDoc/.test(fs.readFileSync(out2, "utf8")), "outside private-bench: the Scores shape only, no document rows or ids");
    const inside = path.join(pdir, "s-full.json");
    run("score-spans.js", ["--gold=" + path.join(pdir, "g2.json"), "--pred=" + path.join(pdir, "p2.json"), "--out=" + inside, "--resamples=50"]);
    ok(fs.existsSync(inside) && /perDoc/.test(fs.readFileSync(inside, "utf8")), "inside private-bench: the full score file");
    g2.name = "dani-notes"; fs.writeFileSync(path.join(pdir, "g3.json"), JSON.stringify(g2));
    const out3 = path.join(dir, "s3.json");
    const r3b = run("score-spans.js", ["--gold=" + path.join(pdir, "g3.json"), "--pred=" + path.join(pdir, "p2.json"), "--out=" + out3, "--resamples=50"]);
    ok(r3b.status === 1 && !fs.existsSync(out3) && !/dani/.test(r3b.stdout + r3b.stderr), "a set name the gate does not know stops the write, and is not echoed");
    const r3c = run("sweep.js", ["--gold=" + path.join(pdir, "g.json"), "--pred=" + path.join(pdir, "p.json"), "--out=" + path.join(dir, "w.json")]);
    ok(r3c.status === 1 && !fs.existsSync(path.join(dir, "w.json")), "a private sweep does not write outside private-bench");
    const r3 = run("sweep.js", ["--gold=" + path.join(pdir, "g.json"), "--pred=" + path.join(pdir, "p.json")]);
    ok(r3.status === 0 && r3.stdout.trim().split("\n").every((l) => /^\{[^֐-׿]*\}$/.test(l)), "private sweep run: JSON numbers per line");
    const r4 = run("compare.js", ["--dir=" + pdir, "--out=" + path.join(dir, "c.md")]);
    ok(r4.status === 1 && !fs.existsSync(path.join(dir, "c.md")), "compare refuses a private-bench folder without --private");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// a span the product returns twice where two chunks overlap is one prediction, not a true and a false positive
{
  const g = { name: "dup", docs: [{ id: "d", text: "אבג דהו זחט", mentions: [{ s: 4, e: 7, type: "PER" }] }] };
  const p = { model: "m", docs: [{ id: "d", spans: [{ s: 4, e: 7, type: "PER", score: 0.7 }, { s: 4, e: 7, type: "PER", score: 0.9 }] }] };
  const r = S.score(g, p, { match: "overlap-typed" });
  ok(r.micro.tp === 1 && r.micro.fp === 0 && r.n.pred === 1, "a repeated span counts once: " + JSON.stringify(r.micro) + " pred " + r.n.pred);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
