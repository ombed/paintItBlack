/* The comparison report (PLAN.md 5.6): section 1 is the pass/fail table of the rule in PLAN.md
   section 1, then one table per set.

     node bench/model-eval/compare.js --dir=bench/model-eval/out [--dir=...more]
          [--out=compare.md] [--baseline=base-q8] [--finalists=a,b] [--tune=synthetic-tune]
          [--heldout=protocol,knesset-ud,...] [--registry=bench/model-eval/registry.json]
          [--private]

   Every .json under the folders is read and sorted by shape: gold sets (docs with mentions),
   predictions (docs with spans), and score files already made elsewhere (micro + match), which
   are shown as they are. Predictions are scored here at each model's cut-off: the baseline at
   its shipped 0.6 (and at its tune optimum, so both are visible), every other model at its
   best F2 on the tune half, ties to the lower value (PLAN.md 3.5).

   A rule whose inputs do not exist yet (product runs, the noise band, the browser, her
   adjudicated false positives) is PENDING, with what it waits for; a report never passes a rule
   it could not check. Intervals are paired bootstrap by the caller's units (doc.unit, else the
   document), at 95%, narrowed by Bonferroni over the named finalists (97.5% for two).

   --private: her documents. Category-level counts only (no document ids, no positions, no
   per-mention rows), in words the privacy gate knows, and everything written or printed goes
   through bench/model-eval/privacy.js; without it nothing is written. */
const fs = require("fs");
const path = require("path");
const S = require("./score-spans.js");
const B = require("./bootstrap.js");
const W = require("./sweep.js");

const LICENCES = new Set(["CC-BY-4.0", "Apache-2.0", "MIT"]);
const MB = 1e6;

function kind(j) {
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  if (j.micro && j.match) return "score";
  if (Array.isArray(j.docs)) {
    if (j.docs.some((d) => d && Array.isArray(d.mentions))) return "gold";
    if (j.docs.some((d) => d && Array.isArray(d.spans)) || j.model != null) return "pred";
    if (j.name != null) return "gold";
  }
  return null;
}

// a file that does not parse is counted and shown in the report, not skipped quietly (a missing
// predictions file would otherwise just drop a model); it is never quoted, since Node's
// JSON.parse error repeats the start of the file. Names are sorted so the report's row order
// does not depend on the file system.
function load(dirs) {
  const inp = { golds: [], preds: [], scores: [], unreadable: 0 };
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".json")) {
        let j; try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { inp.unreadable++; continue; }
        const k = kind(j);
        if (k) inp[k === "gold" ? "golds" : k === "pred" ? "preds" : "scores"].push(j);
      }
    }
  };
  for (const d of dirs) if (fs.existsSync(d)) walk(d);
  return inp;
}

// the spans at or above a cut-off, so two files cut at different values can be diffed
const atCut = (pred, t) => Object.assign({}, pred, { threshold: t,
  docs: (pred.docs || []).map((d) => Object.assign({}, d, { spans: (d.spans || []).filter((sp) => sp.score == null || sp.score >= t) })) });

const f3 = (x) => x == null || !Number.isFinite(x) ? "–" : x.toFixed(3);
const pct = (x) => x == null || !Number.isFinite(x) ? "–" : (100 * x).toFixed(1) + "%";
const ciTxt = (c) => c ? `[${f3(c[0])}, ${f3(c[1])}]` : "–";
const sgn = (x) => (x >= 0 ? "+" : "") + f3(x);

/* Everything the two renderers need, computed once. */
function build(inp, opt) {
  const o = Object.assign({ baseline: "base-q8", floor: ["off", "model-off", "no-model"], finalists: [], tune: "synthetic-tune",
    heldout: null, registry: [], resamples: 2000, seed: 1, private: false }, opt || {});
  const goldBy = new Map(inp.golds.map((g) => [g.name, g]));
  const isFloor = (m) => o.floor.includes(m);
  const heldout = (name) => {
    const g = goldBy.get(name);
    if (o.heldout) return o.heldout.includes(name);
    return !!g && !/^synthetic/.test(name) && name !== "known-cases" && g.licence !== "private" && !o.private;
  };
  const reg = new Map((o.registry || []).map((r) => [r.key, r]));
  // Bonferroni over the finalists actually named (PLAN.md expects at most two)
  const comparisons = Math.max(1, o.finalists.length);
  const level = { resamples: o.resamples, seed: o.seed, comparisons };

  // each model's cut-off from the tune half
  const tuned = new Map();
  const tuneGold = goldBy.get(o.tune);
  for (const p of inp.preds) if (tuneGold && p.set === o.tune && p.stage === "raw" && !tuned.has(p.model)) {
    const sw = W.sweep(tuneGold, p, { match: "overlap-untyped" });
    tuned.set(p.model, { t: sw.best ? sw.best.t : null, ap: sw.ap, f2: sw.best ? sw.best.f2 : null,
      rel: W.reliability(tuneGold, p, { match: "overlap-untyped" }) });
  }
  const cutsOf = (model, stage) => {
    if (stage !== "raw") return [{ t: 0, src: "cleaned" }];
    const tu = tuned.get(model);
    if (model === o.baseline) {
      const out = [{ t: 0.6, src: "shipped" }];
      if (tu && tu.t != null && Math.abs(tu.t - 0.6) > 1e-9) out.push({ t: tu.t, src: "tune" });
      return out;
    }
    return tu && tu.t != null ? [{ t: tu.t, src: "tune" }] : [{ t: 0.6, src: "untuned" }];
  };
  const baseCut = (stage) => stage === "raw" ? 0.6 : 0;

  const sets = [];
  for (const g of inp.golds) {
    const preds = inp.preds.filter((p) => p.set === g.name);
    const scores = inp.scores.filter((s) => s.set === g.name);
    if (!preds.length && !scores.length) continue;
    const rows = [];
    for (const p of preds) for (const c of cutsOf(p.model, p.stage)) {
      const cut = atCut(p, c.t);
      const u = S.score(g, cut, { match: "overlap-untyped" });
      const ty = S.score(g, cut, { match: "overlap-typed" });
      const ex = S.score(g, cut, { match: "word-exact" });
      const per = S.score(g, cut, { match: "overlap-typed", types: ["PER"] });
      const row = { model: p.model, stage: p.stage, t: c.t, src: c.src, u, ty, ex, per, health: p.health || null, timing: p.timing || null };
      if (!o.private) row.ciR = B.ci(B.unitsOf(u.perDoc), B.METRICS.r, { resamples: o.resamples, seed: o.seed }).ci;
      const base = p.model !== o.baseline && preds.find((q) => q.model === o.baseline && q.stage === p.stage);
      if (base) {
        const bc = atCut(base, baseCut(p.stage));
        row.diff = S.diff(g, bc, cut, { match: "overlap-untyped" });
        row.base = { u: S.score(g, bc, { match: "overlap-untyped" }), per: S.score(g, bc, { match: "overlap-typed", types: ["PER"] }) };
        if (!o.private) {
          row.gainR = B.paired(B.unitsOf(u.perDoc), B.unitsOf(row.base.u.perDoc), B.METRICS.r, level);
          row.gainPER = B.paired(B.unitsOf(per.perDoc), B.unitsOf(row.base.per.perDoc), B.METRICS.r, level);
        }
      }
      rows.push(row);
    }
    sets.push({ name: g.name, gold: g, heldout: heldout(g.name), rows, scores });
  }

  // section 1, per candidate (every model but the baseline and the model-off floor)
  const models = [...new Set(inp.preds.map((p) => p.model))].filter((m) => m !== o.baseline && !isFloor(m)).sort();
  const rules = {};
  for (const m of models) {
    const R = {};
    const rowsOf = (pred) => sets.flatMap((s) => s.rows.filter((r) => r.model === m && pred(s, r)).map((r) => ({ set: s.name, r })));
    // health gates every score (PLAN.md 3.1)
    const hbad = inp.preds.filter((p) => p.model === m && p.health).filter((p) => p.health.unmappedLabels || p.health.chunksOver510 || p.health.chunkErrors);
    // alignment losses count on gold-entity tokens only, below 0.5%; without the denominator the
    // check cannot be made, which is not the same as passing it
    const hs = inp.preds.filter((p) => p.model === m && p.health);
    const alignBad = hs.filter((p) => p.health.alignFailEntityTokens > 0 && p.health.entityTokens && p.health.alignFailEntityTokens / p.health.entityTokens >= 0.005);
    const alignUnk = hs.filter((p) => p.health.alignFailEntityTokens > 0 && !p.health.entityTokens);
    R.health = hbad.length ? { st: "FAIL", why: `${hbad.length} prediction file(s) with unmapped labels, chunks over 510 or chunk errors; no score counts` }
      : alignBad.length ? { st: "FAIL", why: `${alignBad.length} prediction file(s) lose 0.5% or more of gold-entity tokens in alignment` }
      : !hs.length ? { st: "PENDING", why: "no health block in the prediction files" }
      : alignUnk.length ? { st: "PENDING", why: `${alignUnk.length} prediction file(s) have alignment failures on gold-entity tokens but give no entity-token count to judge 0.5% against` }
      : { st: "PASS", why: "no unmapped labels, over-long chunks, chunk errors, or alignment losses over 0.5% of gold-entity tokens" };

    // 1: product-level and noise band are other parts' outputs; show the model-level losses meanwhile
    const safety = rowsOf((s, r) => r.stage === "raw" && r.diff && (/^synthetic-(test|tune|all)$/.test(s.name) || s.gold.licence === "private"));
    const lost = safety.reduce((a, x) => a + x.r.diff.entities.onlyA, 0), gained = safety.reduce((a, x) => a + x.r.diff.entities.onlyB, 0);
    R.r1 = { st: "PENDING", why: "needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band" +
      (safety.length ? `; model level, raw: ${lost} entities the baseline finds and this model misses, ${gained} the other way` : "") };

    // 2a: pooled held-out recall gain, PER-typed and untyped, finalists only
    const held = rowsOf((s, r) => s.heldout && r.stage === "raw" && r.gainR);
    let r2a;
    if (!held.length) r2a = { st: "PENDING", why: "no held-out set with predictions for this model and the baseline" };
    else {
      const pool = (key) => {
        const ua = [], ub = [];
        for (const { set, r } of held) {
          const sc = key === "u" ? r.u : r.per, bs = key === "u" ? r.base.u : r.base.per;
          ua.push(...B.unitsOf(sc.perDoc).map((x) => ({ id: set + "/" + x.id, counts: x.counts })));
          ub.push(...B.unitsOf(bs.perDoc).map((x) => ({ id: set + "/" + x.id, counts: x.counts })));
        }
        return B.paired(ua, ub, B.METRICS.r, level);
      };
      const pu = pool("u"), pp = pool("per");
      const worse = held.filter(({ r }) => r.gainR.diff.ci[1] < 0 || r.gainPER.diff.ci[1] < 0).map((x) => x.set);
      const nums = `pooled gain untyped ${sgn(pu.diff.est)} ${ciTxt(pu.diff.ci)}, PER ${sgn(pp.diff.est)} ${ciTxt(pp.diff.ci)} at ${pct(pu.level)} over ${held.map((x) => x.set).join(", ")}`;
      if (!o.finalists.includes(m)) r2a = { st: "n/a", why: "not a finalist, so not tested (PLAN.md 1.2a); " + nums };
      else if (worse.length) r2a = { st: "FAIL", why: "significantly worse on " + worse.join(", ") + "; " + nums };
      else if (pu.diff.ci[0] > 0 && pp.diff.ci[0] > 0) r2a = { st: "PASS", why: nums };
      else r2a = { st: "FAIL", why: "not both headline intervals (PER-typed and untyped) wholly above zero; " + nums };
      R.pooled = { u: pu, per: pp };
    }
    R.r2a = r2a;
    // 2b's recall condition, per set and pooled over the held-out sets
    const negHeld = held.filter(({ r }) => r.gainR.diff.ci[1] < 0).map((x) => x.set);
    if (R.pooled && R.pooled.u.diff.ci[1] < 0) negHeld.push("the pooled held-out sets");
    R.r2b = negHeld.length ? { st: "FAIL", why: "held-out recall significantly negative on " + negHeld.join(", ") }
      : { st: "PENDING", why: "needs the adjudicated model false positives on her documents (PLAN.md 4.4)" + (held.length ? "; held-out recall is not significantly negative" : "") };
    R.r2 = R.r2a.st === "PASS" || R.r2b.st === "PASS" ? { st: "PASS", why: R.r2a.st === "PASS" ? "via (a)" : "via (b)" }
      : R.r2a.st === "FAIL" && R.r2b.st === "FAIL" ? { st: "FAIL", why: "neither (a) nor (b)" }
      : { st: "PENDING", why: "(a) " + R.r2a.st + ", (b) " + R.r2b.st };

    // 3: download from the registry; browser time and memory are Phase 5
    // a -ft run is the same model file with the faithful tokenizer: same size and licence
    const rg = reg.get(m) || reg.get(m.replace(/-ft$/, ""));
    if (!rg || !rg.bytes) R.r3 = { st: "PENDING", why: "no registry size; browser scan time and peak memory come from the browser check (Phase 5)" };
    else {
      const mb = rg.bytes / MB, band = mb <= 250 ? "green" : mb <= 450 ? "amber (owner's OK and a first-run warning)" : "red";
      R.r3 = mb > 450 ? { st: "FAIL", why: `download ${mb.toFixed(0)} MB, red` }
        : { st: "PENDING", why: `download ${mb.toFixed(0)} MB, ${band}; browser scan per 1k words and peak memory come from Phase 5` };
    }
    // 4: licence
    R.r4 = !rg ? { st: "PENDING", why: "not in the registry" }
      : LICENCES.has(rg.licence) && rg.shippable !== false ? { st: "PASS", why: rg.licence }
      : { st: "FAIL", why: (rg.licence || "no licence") + ", measure only" };
    // 5: browser agreement
    R.r5 = { st: "PENDING", why: "browser drift vs Node is measured in Phase 5 (baseline drift first)" };

    const all = [R.health, R.r1, R.r2, R.r3, R.r4, R.r5];
    R.verdict = all.some((x) => x.st === "FAIL") ? "FAIL" : all.every((x) => x.st === "PASS") ? "PASS" : "PENDING";
    rules[m] = R;
  }
  return { o, sets, rules, models, tuned, reg, level: 1 - 0.05 / comparisons, comparisons, unreadable: inp.unreadable || 0 };
}

function renderPublic(M) {
  const { o, sets, rules, models, tuned } = M;
  const L = [];
  L.push("# Model comparison", "");
  if (M.unreadable) L.push(`**${M.unreadable} JSON file(s) in the input folders could not be parsed and are left out of this report.**`, "");
  L.push(`Baseline \`${o.baseline}\`. Finalists: ${o.finalists.length ? o.finalists.map((m) => "`" + m + "`").join(", ") : "none named"}; ` +
    `intervals at ${pct(M.level)} (paired bootstrap, ${o.resamples} resamples, seed ${o.seed}).`, "");
  L.push("## 1. The rule (PLAN.md section 1)", "");
  if (!models.length) L.push("_No candidate predictions found._", "");
  else {
    L.push("| Rule | " + models.join(" | ") + " |", "|---|" + models.map(() => "---|").join(""));
    const line = (label, k) => L.push(`| ${label} | ` + models.map((m) => rules[m][k].st).join(" | ") + " |");
    line("Harness health", "health"); line("1. No new leaks", "r1"); line("2. Real benefit", "r2");
    line("  2a. Better reading", "r2a"); line("  2b. Her time", "r2b"); line("3. Budget", "r3"); line("4. Licence", "r4");
    line("5. Browser = Node", "r5");
    L.push("| **Verdict** | " + models.map((m) => "**" + rules[m].verdict + "**").join(" | ") + " |", "");
    L.push("PENDING means an input is not available yet; it is never read as a pass. A net safety gain is decided by the owner at checkpoint 3.", "");
    for (const m of models) {
      L.push(`### \`${m}\``, "");
      for (const [k, label] of [["health", "Health"], ["r1", "Rule 1"], ["r2a", "Rule 2a"], ["r2b", "Rule 2b"], ["r3", "Rule 3"], ["r4", "Rule 4"], ["r5", "Rule 5"]])
        L.push(`- ${label}: **${rules[m][k].st}**: ${rules[m][k].why}`);
      L.push("");
    }
  }

  L.push("## Tie-break (placeholder until the finalists are known)", "");
  L.push("Higher F2 on the cleaned output, at each model's own cut-off, pooled over the held-out sets; then smaller, then faster. " +
    "Cleaned predictions on the public sets are needed for it; raw F2 is in the set tables below.", "");

  L.push("## Cut-offs (tune half, overlap untyped)", "");
  if (!tuned.size) L.push(`_No raw predictions on \`${o.tune}\`: every non-baseline model is scored at 0.6 and marked untuned._`, "");
  else {
    L.push("| Model | Best-F2 cut-off | F2 there | AP | <.6 correct | .6-.8 | .8-.95 | >=.95 |", "|---|---|---|---|---|---|---|---|");
    for (const [m, t] of [...tuned.entries()].sort()) {
      L.push(`| ${m} | ${t.t == null ? "–" : t.t.toFixed(2)} | ${f3(t.f2)} | ${f3(t.ap)} | ` + t.rel.bands.map((b) => `${pct(b.share)} of ${b.n}`).join(" | ") + " |");
    }
    L.push("");
  }

  L.push("## Harness health", "");
  L.push("| Set | Model | Stage | Unmapped labels | Chunks over 510 | Chunk errors | Align fails on gold-entity tokens | Node scan ms per 1k words |", "|---|---|---|---|---|---|---|---|");
  for (const s of sets) for (const r of s.rows) {
    if (r.src === "tune" && r.model === o.baseline) continue;
    const h = r.health || {}, tm = r.timing || {};
    const al = h.alignFailEntityTokens == null ? "–" : h.entityTokens ? `${h.alignFailEntityTokens} (${pct(h.alignFailEntityTokens / h.entityTokens)})` : h.alignFailEntityTokens ? `${h.alignFailEntityTokens} (share not given)` : "0";
    L.push(`| ${s.name} | ${r.model} | ${r.stage} | ${h.unmappedLabels ?? "–"} | ${h.chunksOver510 ?? "–"} | ${h.chunkErrors ?? "–"} | ${al} | ${tm.words ? (tm.scanMs / tm.words * 1000).toFixed(0) : "–"} |`);
  }
  L.push("");

  for (const s of sets) {
    const g = s.gold;
    L.push(`## ${s.name}${s.heldout ? " (held out)" : ""}`, "");
    const meta = [`${(g.docs || []).length} documents`];
    if (g.licence) meta.push("licence " + g.licence);
    if (g.contamination && g.contamination.length) meta.push("contamination: " + g.contamination.join(", "));
    L.push(meta.join("; ") + ".", "");
    L.push("Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.", "");
    L.push("| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of s.rows) {
      const u = r.u, mi = u.micro;
      const tr = u.trap.n ? `${u.trap.hit}/${u.trap.n}` : "–", ad = u.added.n ? `${pct(u.added.r)} of ${u.added.n}` : "–";
      const lg = r.diff ? `${r.diff.entities.onlyA} / ${r.diff.entities.onlyB}` : "–";
      const gain = r.gainR ? `${sgn(r.gainR.diff.est)} ${ciTxt(r.gainR.diff.ci)}` : "–";
      L.push(`| ${r.model} | ${r.stage} | ${r.stage === "raw" ? r.t.toFixed(2) + " " + r.src : "–"} | ${u.n.gold} | ${mi.tp} | ${mi.fp} | ${mi.fn} | ${f3(mi.p)} | ${f3(mi.r)} | ${ciTxt(r.ciR)} | ${f3(mi.f1)} | ${f3(mi.f2)} | ` +
        `${f3(r.per.micro.r)} | ${f3(r.ex.micro.f1)} | ${u.entity.n ? f3(u.entity.r) : "–"} | ${tr} | ${ad} | ${lg} | ${gain} |`);
    }
    for (const sc of s.scores) {
      const mi = sc.micro;
      L.push(`| ${sc.model} (score file) | ${sc.stage ?? "–"} | ${sc.threshold ?? "–"} | ${mi.tp + mi.fn} | ${mi.tp} | ${mi.fp} | ${mi.fn} | ${f3(mi.p)} | ${f3(mi.r)} | ${ciTxt(sc.ci95 && sc.ci95.r)} | ${f3(mi.f1)} | ${f3(mi.f2)} | – | – | ` +
        `${sc.entity ? f3(sc.entity.r) : "–"} | ${sc.trap ? sc.trap.hit + "/" + sc.trap.n : "–"} | ${sc.added ? f3(sc.added.r) : "–"} | – | – | (${sc.match}) |`);
    }
    L.push("");
    if (s.rows.length) {
      L.push("Per type, overlap typed (P / R / F2):", "");
      L.push("| Model | Stage | Cut-off | " + S.TYPES.join(" | ") + " |", "|---|---|---|" + S.TYPES.map(() => "---|").join(""));
      for (const r of s.rows) L.push(`| ${r.model} | ${r.stage} | ${r.stage === "raw" ? r.t.toFixed(2) : "–"} | ` +
        S.TYPES.map((t) => { const x = r.ty.perType[t]; return x.n || x.np ? `${f3(x.p)} / ${f3(x.r)} / ${f3(x.f2)} (n ${x.n})` : "–"; }).join(" | ") + " |");
      L.push("");
      const cats = [...new Set(s.rows.flatMap((r) => Object.keys(r.u.perCat)))].sort();
      if (cats.length) {
        L.push("Recall per category (overlap untyped):", "");
        L.push("| Category | n | " + s.rows.map((r) => `${r.model} ${r.stage}${r.stage === "raw" ? " " + r.t.toFixed(2) : ""}`).join(" | ") + " |", "|---|---|" + s.rows.map(() => "---|").join(""));
        for (const c of cats) {
          const n = (s.rows[0].u.perCat[c] || { n: 0 }).n;
          L.push(`| ${c} | ${n} | ` + s.rows.map((r) => { const x = r.u.perCat[c]; return x ? `${x.tp} (${pct(x.r)})` : "–"; }).join(" | ") + " |");
        }
        L.push("");
      }
    }
  }
  return L.join("\n") + "\n";
}

/* Her documents: counts per category and per model, in words privacy.js lets through. No set
   is a held-out set here, so there are no intervals (PLAN.md 3.6). */
function renderPrivate(M) {
  const { sets } = M;
  const L = ["# private", ""];
  if (M.unreadable) L.push(`skipped file ${M.unreadable}`, "");
  L.push("## rule 1", "", "| model | set | lost | gain | same |", "|---|---|---|---|---|");
  for (const s of sets) for (const r of s.rows) if (r.diff && r.stage === "raw") {
    const d = r.diff.entities;
    L.push(`| ${r.model} | ${s.name} | ${d.onlyA} | ${d.onlyB} | ${d.both} |`);
  }
  L.push("");
  for (const s of sets) {
    L.push(`## ${s.name}`, "");
    L.push("| model | stage | threshold | n | tp | fp | fn | p | r | f2 | must false | must false found |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of s.rows) {
      const mi = r.u.micro;
      L.push(`| ${r.model} | ${r.stage} | ${r.stage === "raw" ? r.t.toFixed(2) : "0"} | ${r.u.n.gold} | ${mi.tp} | ${mi.fp} | ${mi.fn} | ${f3(mi.p)} | ${f3(mi.r)} | ${f3(mi.f2)} | ${r.u.trap.n} | ${r.u.trap.hit} |`);
    }
    L.push("");
    const cats = [...new Set(s.rows.flatMap((r) => Object.keys(r.u.perCat)))].sort();
    if (cats.length && s.rows.length) {
      L.push("### cat found", "");
      L.push("| cat | n | " + s.rows.map((r) => `${r.model} ${r.stage}`).join(" | ") + " |", "|---|---|" + s.rows.map(() => "---|").join(""));
      for (const c of cats) L.push(`| ${c} | ${(s.rows[0].u.perCat[c] || { n: 0 }).n} | ` + s.rows.map((r) => (r.u.perCat[c] ? r.u.perCat[c].tp : 0)).join(" | ") + " |");
      L.push("");
    }
    const dcats = [...new Set(s.rows.flatMap((r) => (r.diff ? Object.keys(r.diff.byCat) : [])))].sort();
    if (dcats.length) {
      L.push("### cat lost gain", "", "| model | cat | lost | gain |", "|---|---|---|---|");
      for (const r of s.rows) if (r.diff) for (const c of dcats) { const x = r.diff.byCat[c]; if (x) L.push(`| ${r.model} | ${c} | ${x.onlyA} | ${x.onlyB} |`); }
      L.push("");
    }
    const tcats = [...new Set(s.rows.flatMap((r) => Object.keys(r.u.trap.perCat)))].sort();
    if (tcats.length) {
      L.push("### cat must false found", "");
      L.push("| cat | n | " + s.rows.map((r) => `${r.model} ${r.stage}`).join(" | ") + " |", "|---|---|" + s.rows.map(() => "---|").join(""));
      for (const c of tcats) L.push(`| ${c} | ${(s.rows[0].u.trap.perCat[c] || { n: 0 }).n} | ` + s.rows.map((r) => (r.u.trap.perCat[c] ? r.u.trap.perCat[c].hit : 0)).join(" | ") + " |");
      L.push("");
    }
  }
  return L.join("\n") + "\n";
}

/* inp: { golds, preds, scores }; returns the Markdown. With private:true, opt.privacy (the
   privacy.js module) must be given and the text is checked by it before it is returned. */
function compare(inp, opt) {
  const o = Object.assign({}, opt || {});
  if (o.private && !(o.privacy && typeof o.privacy.allow === "function")) throw new Error("compare --private needs bench/model-eval/privacy.js");
  // the public report prints set tables without the gate, so her sets never reach it
  if (!o.private && (inp.golds || []).some((g) => g && g.licence === "private")) throw new Error("a gold set with licence private needs --private");
  if (o.private) inp = Object.assign({}, inp, { scores: [] }); // score files may carry per-document rows
  const M = build(inp, o);
  const md = o.private ? renderPrivate(M) : renderPublic(M);
  return o.private ? o.privacy.allow(md) : md;
}

module.exports = { compare, build, load, kind, atCut };

if (require.main === module) {
  const all = (n) => process.argv.filter((x) => x.startsWith(`--${n}=`)).map((x) => x.slice(n.length + 3));
  const arg = (n, d) => all(n)[0] || d;
  const PRIVATE = process.argv.includes("--private");
  let privacy = null;
  try { privacy = require("./privacy.js"); } catch (_) { privacy = null; }
  const main = () => {
    const dirs = all("dir").length ? all("dir") : [path.join(__dirname, "out")];
    if (!PRIVATE && dirs.some(S.isPrivatePath)) throw new Error("a folder under private-bench/ is read only with --private");
    const regPath = arg("registry", path.join(__dirname, "registry.json"));
    let registry = [];
    try { const j = JSON.parse(fs.readFileSync(regPath, "utf8")); registry = Array.isArray(j) ? j : Object.entries(j).map(([key, v]) => Object.assign({ key }, v)); } catch (_) { registry = []; }
    const opt = { baseline: arg("baseline", "base-q8"), finalists: arg("finalists", "").split(",").filter(Boolean),
      tune: arg("tune", "synthetic-tune"), heldout: arg("heldout") ? arg("heldout").split(",") : null, registry,
      private: PRIVATE, privacy };
    const md = compare(load(dirs), opt);
    const out = arg("out", path.join(dirs[0], PRIVATE ? "compare-private.md" : "compare.md"));
    if (PRIVATE) { privacy.safeWrite(out, md); privacy.safeLog("private", "done"); }
    else { fs.writeFileSync(out, md); console.log("wrote " + out); }
  };
  if (PRIVATE) {
    if (!privacy) { console.error("compare --private: bench/model-eval/privacy.js is missing; nothing written"); process.exitCode = 1; }
    else {
      // errors from a private run can carry text; the gate strips them before they are printed
      try { privacy.wrapErrors(main); } catch (err) { console.error(err.stack); process.exitCode = 1; }
    }
  } else main();
}
