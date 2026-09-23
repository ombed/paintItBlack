/* The known cases judged pass or fail per model (PLAN.md 4.5), by the pass rules written
   in gold/known-cases.json:

     node bench/model-eval/known-score.js --gold=out/gold/known-cases.json --pred=P.json
          [--threshold=0] [--out=K.json]

   --gold is the gold set known-cases.js writes (one doc per case, the rule and the control
   flag on the doc). A case passes when every must mention passes its rule and no span
   touches a must:false mention. Controls are judged and reported, and counted in no total.

   Beside pass or fail, each mention is put in one bucket, so a failing model shows how:
     exact         same start and end
     prefix-cut    same end, starting one letter in, on a prefix letter (the product's own
                   prefix variants then cover the whole word, so nothing is left showing)
     glued-prefix  same end, starting at the recorded prefix letter: reported apart, a fail
     glued         starting earlier, or running into the next word or punctuation
     partial       touching the mention, but short of it
     missed        no span touches it
   covers-core has its own: covered, or the same partial / glued / missed.
   A kind that differs from the key does not fail a case; it is counted apart. */
const TYPES = ["PER", "ORG", "PLACE"];
const PREFIX = "מבלוהשכ";
const RULES = ["exact-or-prefix-cut", "covers-core", "no-span"];

const overlaps = (a, b) => a.s < b.e && b.s < a.e;

// every span must be a non-empty slice of the text, with a known type: a harness error otherwise
function checkSpans(spans, k, len) {
  spans.forEach((x, i) => {
    if (!TYPES.includes(x.type)) throw new Error(`harness error: span #${i} in case #${k} has a type outside ${TYPES.join("/")}`);
    if (!Number.isInteger(x.s) || !Number.isInteger(x.e) || x.s < 0 || x.e <= x.s || x.e > len)
      throw new Error(`harness error: span #${i} in case #${k} has offsets ${x.s}-${x.e} outside the text (length ${len})`);
  });
}

// one must mention under exact-or-prefix-cut
function bucketExact(text, m, spans) {
  const pre = m.prefix ? m.prefix.length : 0;
  let best = "missed", kind = null;
  const rank = { exact: 5, "prefix-cut": 4, "glued-prefix": 3, glued: 2, partial: 1, missed: 0 };
  for (const p of spans) {
    if (!overlaps(p, m)) continue;
    let b;
    if (p.s === m.s && p.e === m.e) b = "exact";
    else if (p.e === m.e && p.s === m.s + 1 && m.e - m.s > 1 && PREFIX.includes(text[m.s])) b = "prefix-cut";
    else if (pre && p.e === m.e && p.s === m.s - pre) b = "glued-prefix";
    else if (p.s < m.s || p.e > m.e) b = "glued";
    else b = "partial";
    if (rank[b] > rank[best]) { best = b; kind = p.type; }
  }
  return { bucket: best, ok: best === "exact" || best === "prefix-cut", kind };
}

// one must mention under covers-core: a span over the core, inside the mention and its prefix
function bucketCore(m, spans) {
  const core = m.core || { s: m.s, e: m.e };
  const lo = m.s - (m.prefix ? m.prefix.length : 0);
  let best = "missed", kind = null;
  const rank = { covered: 3, glued: 2, partial: 1, missed: 0 };
  for (const p of spans) {
    if (!overlaps(p, m)) continue;
    const covers = p.s <= core.s && p.e >= core.e;
    const b = covers && p.s >= lo && p.e <= m.e ? "covered" : p.s < lo || p.e > m.e ? "glued" : "partial";
    if (rank[b] > rank[best]) { best = b; kind = p.type; }
  }
  return { bucket: best, ok: best === "covered", kind };
}

/* judge(goldSet, predFile, opt) -> { cases: [...], totals: {...}, controls: {...} }
   opt.threshold: spans under it are dropped (a span without a score is kept) */
function judge(goldSet, predFile, opt) {
  const o = Object.assign({ threshold: 0 }, opt || {});
  if (typeof o.threshold !== "number" || !(o.threshold >= 0 && o.threshold <= 1)) throw new Error("threshold must be a number from 0 to 1");
  if (!goldSet || !Array.isArray(goldSet.docs)) throw new Error("harness error: the gold set has no docs");
  if (!predFile || !Array.isArray(predFile.docs)) throw new Error("harness error: the predictions have no docs");
  const byId = new Map();
  predFile.docs.forEach((d, k) => {
    if (byId.has(d.id)) throw new Error(`harness error: predictions document #${k} repeats an id`);
    byId.set(d.id, d);
  });
  const cases = goldSet.docs.map((d, k) => {
    if (!RULES.includes(d.pass)) throw new Error(`harness error: case #${k} has no known pass rule`);
    const pd = byId.get(d.id);
    // a case the run skipped would read as a pass under no-span: refuse it instead
    if (!pd) throw new Error(`harness error: case #${k} has no predictions document`);
    const all = pd.spans || [];
    checkSpans(all, k, d.text.length);
    const spans = all.filter((p) => p.score == null || p.score >= o.threshold);
    const r = { id: d.id, group: d.genre, rule: d.pass, control: !!d.control,
      musts: 0, ok: 0, negativeHits: 0, kindMismatch: 0, buckets: {} };
    for (const m of d.mentions) {
      if (!m.must) {
        if (spans.some((p) => overlaps(p, m))) r.negativeHits++;
        continue;
      }
      if (d.pass === "no-span") continue;
      r.musts++;
      const j = d.pass === "covers-core" ? bucketCore(m, spans) : bucketExact(d.text, m, spans);
      r.buckets[j.bucket] = (r.buckets[j.bucket] || 0) + 1;
      if (j.ok) r.ok++;
      if (j.kind && m.type && j.kind !== m.type) r.kindMismatch++;
    }
    r.pass = r.ok === r.musts && r.negativeHits === 0;
    return r;
  });
  const sum = (list) => {
    const t = { cases: list.length, passed: 0, byGroup: {}, buckets: {}, negativeHits: 0, kindMismatch: 0 };
    for (const c of list) {
      if (c.pass) t.passed++;
      const g = t.byGroup[c.group] || (t.byGroup[c.group] = { cases: 0, passed: 0 });
      g.cases++; if (c.pass) g.passed++;
      for (const [b, n] of Object.entries(c.buckets)) t.buckets[b] = (t.buckets[b] || 0) + n;
      t.negativeHits += c.negativeHits;
      t.kindMismatch += c.kindMismatch;
    }
    return t;
  };
  return { model: predFile.model, stage: predFile.stage, threshold: o.threshold, cases,
    totals: sum(cases.filter((c) => !c.control)), controls: sum(cases.filter((c) => c.control)) };
}

function render(J) {
  const L = [];
  L.push(`${J.model || "?"} ${J.stage || ""} at ${J.threshold}: ${J.totals.passed} of ${J.totals.cases} cases pass` +
    ` (controls ${J.controls.passed} of ${J.controls.cases}, counted in no total)`);
  for (const [g, t] of Object.entries(J.totals.byGroup)) L.push(`  ${g}: ${t.passed} of ${t.cases}`);
  L.push("  mentions: " + Object.entries(J.totals.buckets).map(([b, n]) => `${b} ${n}`).join(", "));
  L.push(`  spans on a negative: ${J.totals.negativeHits}; kind differs from the key: ${J.totals.kindMismatch}`);
  const failed = J.cases.filter((c) => !c.pass && !c.control).map((c) => c.id);
  if (failed.length) L.push("  failed: " + failed.join(" "));
  return L.join("\n");
}

module.exports = { judge, render, bucketExact, bucketCore, RULES, PREFIX };

if (require.main === module) {
  const { cli } = require("./score-spans.js");
  cli(process.argv.slice(2), (io) => {
    const gold = io.read("gold"), pred = io.read("pred");
    const J = judge(gold, pred, { threshold: Number(io.arg("threshold", "0")) });
    // the known cases are invented text, but a private run still goes through the gate
    io.log({ passed: J.totals.passed, cases: J.totals.cases }, render(J));
    const out = io.arg("out");
    if (out) io.write(out, J);
  });
}
