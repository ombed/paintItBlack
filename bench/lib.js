/* The benchmark as a library: makeBench(E) binds the chain and the scoring
   to one engine module, so run.js scores the shipped engine and sweep.js
   scores patched variants of it side by side.

   The chain, as the product runs it, with confirmation simulated by
   accepting every suggestion:

     discover + model suggest  ->  she confirms all  ->  engine replaces
     -> near-miss scan + verification  ->  she taps every one-tap fix
     -> engine replaces again  ->  final text

   Three separate columns, because they cost different things:
     missed  - surfaced nowhere, she is never asked
     leaked  - an identifying surface form is still in the final text;
               this is the failure the tool exists to prevent, counted
               even when it overlaps with missed
     fp      - a trap or a public body was suggested or replaced, or the
               scanner merged the two edit-distance-1 people; one tap each

   "Found" means some surface of the entity was surfaced somewhere: by
   discover, by the model, in the verification suggestions, by the
   near-miss scan, or as a flagged item for review. Matching is on
   normalised text: whole-string equality, or one side containing the
   other as a whole word of at least three letters. That is deliberately
   generous, because a surfaced surname counts as her being asked.

   Junk is counted, never optimised for: "unlisted" suggestions match
   nothing in the key and cost one tap each to dismiss. The user reads the
   list; accept-all is not how the tool is used. */
const fs = require("fs");
const path = require("path");

const KEY = JSON.parse(fs.readFileSync(path.join(__dirname, "key.json"), "utf8"));
const OPT = { on: new Set(["ISRAELI_ID", "PHONE_MOBILE", "EMAIL", "PLACES", "ADDRESS_STREET"]),
  flag: new Set(["NAME_ANCHORED"]), mode: "real", near: true, prefixes: "normal" };
const LABEL_KIND = { "שם": "NAME", "גוף": "ORG", "מקום": "PLACE", "יישוב": "PLACE", "רחוב": "PLACE", "כתובת": "PLACE" };
const TITLE = /^(עו"ד|ד"ר|גב'|משפחת|המבקשת|הנתבע|התובעת|מר) /;

const strip = (s) => String(s || "").replace(/[֑-ׇ]/g, "");
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function loadModel() {
  const T = await import("@huggingface/transformers");
  T.env.allowLocalModels = false;
  return T.pipeline("token-classification", "onnx-community/dictabert-ner-ONNX", { dtype: "q8" });
}

function makeBench(E, opt) {
  // the product's option set: every detector marked on, places on, the rest
  // flagged for review; the body layer runs only when the model does not
  const on = new Set(E.PAT.filter((p) => p.on).map((p) => p.n)); on.add("PLACES");
  const flag = new Set(E.PAT.filter((p) => !p.on).map((p) => p.n)); flag.add("NAME_ANCHORED");
  const O = Object.assign({}, OPT, { on, flag }, opt || {});
  const norm = (s) => E.norm(strip(s)).trim();
  // needle as whole word(s) inside hay, allowing one Hebrew prefix letter before it
  const wordIn = (hay, needle) => needle.length >= 3 && new RegExp("(^|[^א-ת])[בהולמכש]?" + rx(needle) + "(?![א-ת])").test(hay);
  const hit = (a, b) => a === b || wordIn(a, b) || wordIn(b, a);

  // mirrors nerRun: chunk, run, align, group, clean. rawOut, when given,
  // receives the grouped spans before cleaning, for the span studies.
  async function modelSuggest(pipe, blocks, rawOut) {
    if (!pipe) return [];
    const text = blocks.map((b) => b.text).join("\n");
    const ents = [];
    for (const { t, off } of E.nerChunks(text)) {
      let res = await pipe(t, { ignore_labels: [] });
      if (!Array.isArray(res)) res = res ? [res] : [];
      E.nerAlign(t, res, off);
      for (const g of E.nerGroup(res)) ents.push({ type: g.type, score: g.score, s: g.s, e: g.e, chunkOff: off, chunkLen: t.length });
    }
    if (rawOut) rawOut.push(...ents.map((e) => ({ ...e, text: text.slice(e.s, e.e) })));
    return E.nerClean(ents, text);
  }
  async function blocksOf(buf) {
    const files = await E.unzip(buf.slice(0));
    let blocks = [];
    for (const f of files) if (E.TEXTPART.test(f.name)) {
      const d = E.parseXML(E.TXT.decode(f.data)); E.acceptTracked(d);
      blocks = blocks.concat(E.flatten(d, f.name));
    }
    return blocks;
  }
  const kindOf = (v) => (E.cleanEntry(v).kind) || "NAME";
  function addRule(rules, value, kind, rep) {
    const k = norm(value);
    if (!k || rules.some((r) => norm(r.value) === k)) return;
    rules.push({ value: String(value).trim(), kind: kind || "NAME", replacement: rep || "" });
  }

  async function runDoc(pipe, doc, rawOut) {
    const raw = fs.readFileSync(path.join(__dirname, doc.file));
    const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const blocks = await blocksOf(buf);
    const surfaced = new Map(); // norm -> {value, sources}
    const surface = (v, src) => { const k = norm(v); if (!k) return; const o = surfaced.get(k) || { value: v, sources: new Set() }; o.sources.add(src); surfaced.set(k, o); };

    const cands = E.discover(blocks);
    const model = await modelSuggest(pipe, blocks, rawOut);
    const why = new Map();
    for (const c of cands) { surface(c.value, "discover"); why.set(norm(c.value), c.why); }
    for (const m of model) surface(m.value, "model");

    const rules = [];
    for (const c of cands) addRule(rules, c.value, kindOf(c.value));
    for (const m of model) addRule(rules, m.value, m.kind || kindOf(m.value));
    // the product runs the verb layer with the model since v14 (it used to turn
    // it off, which cost four leaks on this corpus); an explicit body option
    // (the sweep) overrides that
    const OD = { ...O, body: "body" in (opt || {}) ? opt.body : true };
    const r1 = await E.redactDocx(buf, rules, [], OD);
    const near = r1.verification.near || [], sugg = r1.verification.suggest || [], flagged = r1.flagged || [];
    for (const x of sugg) surface(x.value, "suggest");
    for (const x of near) surface(x.value, "near");
    for (const x of flagged) surface(x.value, "flagged");

    const rules2 = rules.slice();
    for (const x of sugg) addRule(rules2, x.value, kindOf(x.value));
    for (const x of near) addRule(rules2, x.value, (x.near && x.near.kind) || "NAME", x.near && x.near.rep);
    for (const x of flagged) addRule(rules2, x.value, LABEL_KIND[x.label] || kindOf(x.value));
    const r2 = await E.redactDocx(buf, rules2, [], OD);
    const out = norm(r2.preview.map((b) => b.text).join("\n"));
    const applied = new Set([...r1.applied, ...r2.applied].map((a) => norm(a.base || a.value)));
    return { surfaced, applied, near, out, rules: rules2.length, why, model, text: blocks.map((b) => b.text).join("\n") };
  }

  function scoreDoc(doc, res) {
    const keys = [...res.surfaced.keys()];
    const rows = [];
    // Trap text is removed before leak-checking: "מדור שלישי" is the idiom,
    // not the person named דור, and a prefix-tolerant match cannot tell.
    let outForLeak = res.out;
    for (const t of doc.entities.filter((e) => e.kind === "TRAP")) for (const sf of t.surfaces) outForLeak = outForLeak.split(norm(sf)).join(" ");
    const pairs = doc.entities.filter((e) => e.cat === "P_ED1_PAIR").map((e) => e.surfaces.map(norm));
    for (const e of doc.entities) {
      const surfaces = e.surfaces.map(norm);
      const bare = [...new Set([norm(e.canonical.replace(TITLE, "")), ...surfaces.map((s) => s.replace(TITLE, "").trim())])];
      const row = { doc: doc.id, genre: doc.genre, cat: e.cat, canonical: e.canonical, found: false, leaked: false, fp: 0, via: [], matched: [], leakedSurfaces: [] };
      if (e.must) {
        for (const s of surfaces) for (const k of keys) if (hit(k, s)) { row.found = true; row.matched.push(res.surfaced.get(k).value); for (const src of res.surfaced.get(k).sources) row.via.push(src); }
        // replaced automatically by a pattern detector without being surfaced: handled, not missed
        for (const s of surfaces) for (const k of res.applied) if (hit(k, s)) { row.found = true; row.matched.push(k); row.via.push("applied"); }
        row.leakedSurfaces = bare.filter((s) => s.length >= 3 && wordIn(outForLeak, s));
        row.leaked = row.leakedSurfaces.length > 0;
        if (e.cat === "P_ED1_PAIR") {
          // merged = the scanner flagged this person as a typo of the other
          const other = pairs.find((p) => !p.includes(surfaces[0])) || [];
          for (const x of res.near) if (surfaces.some((s) => hit(norm(x.value), s)) && other.some((o) => hit(norm(x.near && x.near.target), o))) row.fp++;
        }
      } else {
        // a trap or a public body: any suggestion or replacement touching it is a false positive
        const suggested = surfaces.some((s) => keys.some((k) => hit(k, s)));
        const altered = surfaces.some((s) => s.length >= 3 && !res.out.includes(s));
        row.fp = suggested || altered ? 1 : 0;
        row.matched = suggested ? keys.filter((k) => surfaces.some((s) => hit(k, s))).map((k) => res.surfaced.get(k).value + " [" + [...res.surfaced.get(k).sources].join("+") + "]") : [];
        row.leakedSurfaces = surfaces.filter((s) => s.length >= 3 && !res.out.includes(s)).map((s) => "altered: " + s);
        row.found = null; row.leaked = null;
      }
      row.via = [...new Set(row.via)]; row.matched = [...new Set(row.matched)];
      rows.push(row);
    }
    // suggestions that match nothing in the key at all: one tap each
    const all = doc.entities.flatMap((e) => e.surfaces.map(norm));
    const unlisted = keys.filter((k) => !all.some((s) => hit(k, s))).map((k) => {
      const o = res.surfaced.get(k), applied = [...res.applied].some((a) => a === k || hit(a, k));
      return { value: o.value, sources: [...o.sources], why: res.why.get(k) || "", applied };
    });
    return { rows, unlisted, applied: [...res.applied] };
  }

  function table(rows, groupBy, label) {
    const g = {};
    for (const r of rows) {
      const k = r[groupBy];
      const o = g[k] || (g[k] = { n: 0, found: 0, missed: 0, leaked: 0, fp: 0, scored: 0 });
      o.n++;
      if (r.found !== null) { o.scored++; if (r.found) o.found++; else o.missed++; if (r.leaked) o.leaked++; }
      o.fp += r.fp;
    }
    const lines = [`| ${label} | found | missed | leaked | false positives |`, "|---|---|---|---|---|"];
    for (const k of Object.keys(g)) {
      const o = g[k];
      const name = groupBy === "cat" ? (KEY.categories[k] || k) : k;
      const mark = groupBy === "cat" && KEY.expectedFail.includes(k) ? " (expected to fail)" : groupBy === "cat" && KEY.exemptFromDisjoint.includes(k) && k !== "T_IDIOM" ? " (lexicon-aided)" : "";
      lines.push(`| ${name}${mark} | ${o.scored ? o.found : "–"} | ${o.scored ? o.missed : "–"} | ${o.scored ? o.leaked : "–"} | ${o.fp} |`);
    }
    return lines.join("\n");
  }

  // the whole corpus in one call: totals plus the rows, for sweeps
  async function runAll(pipe, rawOut) {
    const rows = [], unlisted = [], perDoc = [];
    for (const doc of KEY.docs) {
      const t1 = Date.now();
      const res = await runDoc(pipe, doc, rawOut);
      const s = scoreDoc(doc, res);
      rows.push(...s.rows);
      unlisted.push(...s.unlisted.map((u) => ({ doc: doc.id, genre: doc.genre, ...u })));
      perDoc.push({ id: doc.id, genre: doc.genre, ms: Date.now() - t1, rules: res.rules, unlisted: s.unlisted.length });
    }
    const scored = rows.filter((r) => r.found !== null);
    const totals = { leaked: scored.filter((r) => r.leaked).length, missed: scored.filter((r) => !r.found).length,
      fp: rows.reduce((n, r) => n + r.fp, 0), junk: unlisted.length, ms: perDoc.reduce((n, d) => n + d.ms, 0) };
    return { rows, unlisted, perDoc, totals };
  }

  return { runDoc, scoreDoc, table, runAll, blocksOf, modelSuggest, norm, hit, wordIn, KEY, OPT: O };
}

module.exports = { makeBench, loadModel, KEY, OPT, LABEL_KIND, TITLE };
