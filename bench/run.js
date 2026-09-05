/* Scores the whole chain on the synthetic corpus, per category and per genre.

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

   --no-model skips the NER model and scores the deterministic layers alone. */
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");

const KEY = JSON.parse(fs.readFileSync(path.join(__dirname, "key.json"), "utf8"));
const NO_MODEL = process.argv.includes("--no-model");
const OPT = { on: new Set(["ISRAELI_ID", "PHONE_MOBILE", "EMAIL", "PLACES", "ADDRESS_STREET"]),
  flag: new Set(["NAME_ANCHORED"]), mode: "real", near: true, prefixes: "normal" };
const LABEL_KIND = { "שם": "NAME", "גוף": "ORG", "מקום": "PLACE", "יישוב": "PLACE", "רחוב": "PLACE", "כתובת": "PLACE" };
const TITLE = /^(עו"ד|ד"ר|גב'|משפחת|המבקשת|הנתבע|התובעת|מר) /;

const strip = (s) => String(s || "").replace(/[֑-ׇ]/g, "");
const norm = (s) => E.norm(strip(s)).trim();
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// needle as whole word(s) inside hay, allowing one Hebrew prefix letter before it
const wordIn = (hay, needle) => needle.length >= 3 && new RegExp("(^|[^א-ת])[בהולמכש]?" + rx(needle) + "(?![א-ת])").test(hay);
const hit = (a, b) => a === b || wordIn(a, b) || wordIn(b, a);

async function loadModel() {
  if (NO_MODEL) return null;
  const T = await import("@huggingface/transformers");
  T.env.allowLocalModels = false;
  return T.pipeline("token-classification", "onnx-community/dictabert-ner-ONNX", { dtype: "q8" });
}
// mirrors nerRun: chunk, run, align, group, clean
async function modelSuggest(pipe, blocks) {
  if (!pipe) return [];
  const text = blocks.map((b) => b.text).join("\n");
  const ents = [];
  for (const { t, off } of E.nerChunks(text)) {
    let res = await pipe(t, { ignore_labels: [] });
    if (!Array.isArray(res)) res = res ? [res] : [];
    E.nerAlign(t, res, off);
    for (const g of E.nerGroup(res)) ents.push({ type: g.type, score: g.score, s: g.s, e: g.e });
  }
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

async function runDoc(pipe, doc) {
  const raw = fs.readFileSync(path.join(__dirname, doc.file));
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const blocks = await blocksOf(buf);
  const surfaced = new Map(); // norm -> {value, sources}
  const surface = (v, src) => { const k = norm(v); if (!k) return; const o = surfaced.get(k) || { value: v, sources: new Set() }; o.sources.add(src); surfaced.set(k, o); };

  const cands = E.discover(blocks);
  const model = await modelSuggest(pipe, blocks);
  const why = new Map();
  for (const c of cands) { surface(c.value, "discover"); why.set(norm(c.value), c.why); }
  for (const m of model) surface(m.value, "model");

  const rules = [];
  for (const c of cands) addRule(rules, c.value, kindOf(c.value));
  for (const m of model) addRule(rules, m.value, m.kind || kindOf(m.value));
  const r1 = await E.redactDocx(buf, rules, [], OPT);
  const near = r1.verification.near || [], sugg = r1.verification.suggest || [], flagged = r1.flagged || [];
  for (const x of sugg) surface(x.value, "suggest");
  for (const x of near) surface(x.value, "near");
  for (const x of flagged) surface(x.value, "flagged");

  const rules2 = rules.slice();
  for (const x of sugg) addRule(rules2, x.value, kindOf(x.value));
  for (const x of near) addRule(rules2, x.value, (x.near && x.near.kind) || "NAME", x.near && x.near.rep);
  for (const x of flagged) addRule(rules2, x.value, LABEL_KIND[x.label] || kindOf(x.value));
  const r2 = await E.redactDocx(buf, rules2, [], OPT);
  const out = norm(r2.preview.map((b) => b.text).join("\n"));
  const applied = new Set([...r1.applied, ...r2.applied].map((a) => norm(a.base || a.value)));
  return { surfaced, applied, near, out, rules: rules2.length, why };
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
      row.matched = suggested ? keys.filter((k) => surfaces.some((s) => hit(k, s))).map((k) => res.surfaced.get(k).value) : [];
      row.leakedSurfaces = altered ? ["altered in output"] : [];
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

(async () => {
  const t0 = Date.now();
  const pipe = await loadModel();
  if (pipe) console.log(`model loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const rows = [], unlisted = [], perDoc = [];
  for (const doc of KEY.docs) {
    const t1 = Date.now();
    const res = await runDoc(pipe, doc);
    const s = scoreDoc(doc, res);
    rows.push(...s.rows);
    unlisted.push(...s.unlisted.map((u) => ({ doc: doc.id, genre: doc.genre, ...u })));
    perDoc.push({ id: doc.id, genre: doc.genre, ms: Date.now() - t1, rules: res.rules, unlisted: s.unlisted.length });
  }
  const out = [];
  out.push(`# Benchmark results${NO_MODEL ? " (no model)" : ""}`, "", `${KEY.docs.length} documents, ${rows.length} keyed entities, model ${NO_MODEL ? "off" : "on (q8, same artifact as the browser)"}. Generated ${new Date().toISOString().slice(0, 10)}.`, "");
  out.push("## Per category", "", table(rows, "cat", "category"), "");
  out.push("## Per genre", "", table(rows, "genre", "genre"), "");
  const unl = {}; for (const u of unlisted) (unl[u.genre] = unl[u.genre] || []).push(u);
  out.push("## Unlisted suggestions (match nothing in the key; one tap each)", "");
  for (const gname of Object.keys(unl)) out.push(`- **${gname}** (${unl[gname].length}, ${unl[gname].filter((u) => u.applied).length} applied): ` + unl[gname].map((u) => `${u.value} [${u.sources.join("+")}${u.why ? "; " + u.why : ""}]${u.applied ? " **applied**" : ""}`).join(" · "));
  if (!unlisted.length) out.push("- none");
  out.push("", "## Missed and leaked, by document", "");
  for (const r of rows.filter((r) => r.found === false || r.leaked)) out.push(`- ${r.doc} · ${KEY.categories[r.cat]} · ${r.canonical}: ${r.found === false ? "missed" : "found via " + r.via.join("+") + " as «" + r.matched.join("», «") + "»"}${r.leaked ? ", **leaked**: " + r.leakedSurfaces.join(", ") : ""}`);
  out.push("", "## Traps and public bodies touched", "");
  for (const r of rows.filter((r) => r.found === null && r.fp)) out.push(`- ${r.doc} · ${KEY.categories[r.cat]} · ${r.canonical}: ${r.matched.length ? "suggested as «" + r.matched.join("», «") + "»" : ""}${r.leakedSurfaces.length ? (r.matched.length ? "; " : "") + "altered in the output" : ""}`);
  out.push("", "## Timing", "", "| doc | genre | ms | rules confirmed | unlisted |", "|---|---|---|---|---|");
  for (const d of perDoc) out.push(`| ${d.id} | ${d.genre} | ${d.ms} | ${d.rules} | ${d.unlisted} |`);
  const md = out.join("\n") + "\n";
  fs.writeFileSync(path.join(__dirname, NO_MODEL ? "results-no-model.md" : "results.md"), md);
  fs.writeFileSync(path.join(__dirname, NO_MODEL ? "results-no-model.json" : "results.json"), JSON.stringify({ rows, unlisted, perDoc }, null, 1));
  console.log(md);
})().catch((e) => { console.error(e); process.exit(1); });
