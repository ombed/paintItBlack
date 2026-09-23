/* The synthetic gold set with positions (PLAN.md 4.1, FORMATS.md "Gold set"):
   node bench/model-eval/gold-synth.js

   bench/key.json lists each entity's surface forms but not where they are. The
   models are scored on spans, so every occurrence of every surface is located in
   the exact text the product hands the model: the blocks of E.readBlocks(buf),
   their .text joined with "\n" (nerRun in engine/08-docx.js).

   How an occurrence is found:
   - trap surfaces are located first and their text is claimed, so "חיים" inside
     the idiom "בחיים לא ראיתי" is not a person;
   - then every other surface, longest first across the whole document, so the
     bare surname inside a full name's occurrence belongs to the full name;
   - whole words only, with an optional prefix (one letter, or the engine's
     two-letter forms) that is recorded on the mention but is not part of it;
   - titles and role words are left out of a person's span (PLAN.md 4.2);
   - nikud, geresh forms and hyphen/space are matched the way the product
     matches (E.norm, E.flex), on normalised text that keeps every offset.

   Kinds: NAME -> PER, ORG -> ORG, PLACE -> PLACE. TRAP entities and public
   bodies become negatives (must:false). PII (IDs, phones, dates...) is not NER
   and is left out. Surfaces that cannot be located are reported, never guessed.

   Output, under bench/model-eval/out/gold/ (gitignored): synthetic-tune.json,
   synthetic-test.json, synthetic-all.json, and synthetic-report.json with the
   unlocated surfaces, the occurrences an overlapping claim cost, and the
   counts. */
const fs = require("fs");
const path = require("path");

const BENCH = path.join(__dirname, "..");
const OUT = path.join(__dirname, "out", "gold");

const KIND_TYPE = { NAME: "PER", ORG: "ORG", PLACE: "PLACE" };
/* A trap has no NER type of its own; the negative takes the type a model would
   most likely give it by mistake, so a typed score counts the mistake too. */
const TRAP_TYPE = { T_PLONI: "PER", T_IDIOM: "PER", T_FORMLABEL: "PER", T_TZSPLIT: "PER",
  T_UNDERSIGNED: "PER", O_ROLEWORD: "PER", T_GAZWORD: "PLACE", T_NUMBERS: "ORG",
  // the private fixtures' traps (gold-private.js): a role word left by a phrase, a WhatsApp
  // part marker and timestamp, public bodies and companies
  T_PHRASE_REMNANT: "PER", T_WHATSAPP_SPLIT: "ORG", T_PUBLIC_BODY: "ORG", T_PUBLIC_COMPANY: "ORG" };
// comments and file properties are not in readBlocks' text by design (lib.js REMOVED_BY_DESIGN)
const NOT_IN_TEXT = new Set(["S_COMMENT", "S_META"]);
// the engine's prefix sets (SING and DBL in redact-engine.js); two letters tried first
const SING = ["ה", "ו", "ב", "ל", "מ", "כ", "ש"];
const DBL = ["וה", "ול", "וב", "ומ", "וכ", "וש", "שה", "של", "שב", "שכ", "שמ", "כש", "מה", "לכ", "בה"];
const PFX_SET = new Set(SING);
/* Names in the text that the key does not list (PLAN.md 4.1, "the known f1 gap").
   ירושלים is the court's seat in f1: a public place, so a negative like a public
   body; the model proposed it and the bench counted it as junk. */
const GAPS = [
  { doc: "f1", surface: "ירושלים", type: "PLACE", must: false, cat: "L_PUBLIC", note: "the court's seat, public; not keyed" },
];

// titles and role words written before a name in the key's surfaces
const LEAD = /^(?:עו"ד|עו"ס|ד"ר|גב'|מר|משפחת|המבקשת|המבקש|המשיבה|המשיב|הנתבעת|הנתבע|התובעת|התובע|העד|הקטינה|הקטין|השופטת|השופט|יו"ר|המורה|למורה|המטפלת|הגננת|האח|האחות)$/;
const TRAIL = new Set(["אמר", "אמרה", "אמרו"]);
const NIKUD = /[֑-ׇ]/g;
const LET = "A-Za-zא-ת";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (s) => String(s).replace(NIKUD, "").split(/[\s-]+/).filter(Boolean);

let E = null;
const engine = () => E || (E = require("../engine.js"));

/* The name part of a surface: nikud off, and for a person any leading or
   trailing word that is not part of the canonical name (a title, a role word,
   "התובע:", "האח", a speech verb) off, because titles and role words are left
   out of the span (PLAN.md 4.2). */
function bareSurface(sf, kind, canonical) {
  let s = String(sf).replace(NIKUD, "").replace(/\s+/g, " ").trim();
  if (kind === "NAME" && canonical) {
    const canon = new Set(words(canonical));
    let w = s.split(" ");
    // only listed words: a corrupted spelling ("ווארקו" for "וורקו") is not in the canonical either
    const inCanon = (x) => words(x.replace(/:$/, "")).some((y) => canon.has(y));
    while (w.length > 1 && !inCanon(w[0]) && (LEAD.test(w[0]) || /:$/.test(w[0]))) w = w.slice(1);
    // "אור אמרה" keys the speech verb as context; the verb is not the name
    while (w.length > 1 && !inCanon(w[w.length - 1]) && (TRAIL.has(w[w.length - 1]) || engine().VRB.has(w[w.length - 1]))) w = w.slice(0, -1);
    s = w.join(" ");
  }
  return s;
}

/* One regex per surface, run on norm(text) (same length as text, nikud as \0).
   Boundaries are written here rather than taken from E.NW/E.NWE because those
   read nikud as a letter only before norm; after norm a \0 must count as part
   of the word. Group 1 is the prefix, group 2 the surface. */
function surfaceRx(sf) {
  const N = engine();
  const body = [...N.norm(sf)].map((c) => (/[\s-]/.test(c) ? "[\\s-]+" : esc(c))).join("\u0000*");
  const first = sf[0], last = sf[sf.length - 1];
  const letterStart = /[א-תA-Za-z]/.test(first), digitEnd = /[0-9]/.test(last);
  const pfx = letterStart && /[א-ת]/.test(first) ? `((?:${DBL.join("|")}|${SING.join("|")})\u0000*)?` : "()";
  /* not inside a word, not after a letter's nikud, not inside an acronym (עו"ד:
     two letters before the quote) or after a geresh (ג'ורג'). One letter before a
     quote opens a quotation (ל"דנה"), the engine's NW rule, so the name there is
     found; without this a quoted name was silently missing from the gold. */
  const start = `(?<![${LET}0-9\u0000])(?<![${LET}0-9\u0000][${LET}0-9\u0000]")(?<![${LET}0-9\u0000]')`;
  // a letter glued to a digit is a boundary (the engine's rule), a letter to a letter is not
  const end = digitEnd ? "(?![0-9])" : `\u0000*(?![${LET}\u0000])(?!["'][${LET}])`;
  return new RegExp(start + pfx + "(" + body + ")" + end, "g");
}

/* Every occurrence of the given surfaces in text. entities: the key's entities
   for one document, each {kind, cat, must, canonical, surfaces}; gaps: extra
   {surface, type, must, cat} for names the key does not list. Returns
   {mentions, unlocated}. Offsets are into text, e exclusive.

   A person's first name or surname on its own, where the key lists only the
   full name (the generator writes first(x) and last(x) freely), is still that
   person: each word of the canonical name of three letters or more is located
   last, after every keyed surface, and its mentions carry derived:true. */
function locate(text, entities, docId, gaps) {
  const N = engine();
  const nt = N.norm(text);
  const claimed = []; // [s, e) ranges already taken
  const free = (s, e) => !claimed.some(([a, b]) => s < b && e > a);
  const mentions = [], unlocated = [], partly = [];
  const jobs = [];
  entities.forEach((ent, i) => {
    if (ent.kind === "PII") return;
    const trap = ent.kind === "TRAP";
    const type = trap ? TRAP_TYPE[ent.cat] : KIND_TYPE[ent.kind];
    // a kind or trap category the key gains later must be mapped here, never dropped or guessed
    if (!type) throw new Error(`${docId}#${i}: no NER type for kind ${ent.kind}, category ${ent.cat}`);
    const seen = new Set();
    const must = trap ? false : !!ent.must;
    for (const raw of ent.surfaces) {
      const sf = bareSurface(raw, ent.kind, ent.canonical);
      if (!sf || seen.has(sf)) continue;
      seen.add(sf);
      jobs.push({ id: docId + "#" + i, ent, raw, sf, trap, type, must, rank: 1 });
    }
    if (ent.kind === "NAME") for (const w of words(ent.canonical)) {
      if (w.length < 3 || seen.has(w)) continue;
      seen.add(w);
      jobs.push({ id: docId + "#" + i, ent, raw: w, sf: w, trap, type, must, rank: 0, derived: true });
    }
  });
  (gaps || []).forEach((g, k) => jobs.push({ id: docId + "#gap" + k, ent: { cat: g.cat }, raw: g.surface,
    sf: bareSurface(g.surface), trap: false, type: g.type, must: !!g.must, rank: 1, gap: true }));
  // traps first; then keyed surfaces longest first; then derived name parts; ties keep key order
  const order = new Map(jobs.map((j, n) => [j, n]));
  jobs.sort((a, b) => (b.trap - a.trap) || (b.rank - a.rank) || (b.sf.length - a.sf.length) || (order.get(a) - order.get(b)));
  const hits = new Map(); // job -> count
  for (const j of jobs) {
    let n = 0;
    const rx = surfaceRx(j.sf);
    for (const m of nt.matchAll(rx)) {
      const p = m[1] || "";
      const s = m.index + p.length;
      const e = m.index + m[0].length;
      if (!free(s, e)) {
        /* inside a longer claim is the design (a surname inside the full name); a
           claim that only overlaps, as a trap "עם שחר" over "שחר גולן", cost a real
           occurrence, so it is reported rather than lost silently */
        if (!claimed.some(([a, b]) => a <= s && b >= e)) partly.push({ doc: docId, ent: j.id, cat: j.ent.cat, surface: j.raw, s, e });
        continue;
      }
      claimed.push([s, e]);
      const o = { s, e, type: j.type, must: j.must, cat: j.ent.cat, ent: j.id };
      // the prefix is left out of the span and recorded as written, nikud included,
      // so s - prefix.length is where the orthographic word starts (PLAN.md 4.2)
      if (p) o.prefix = text.slice(m.index, s);
      if (j.derived) o.derived = true;
      if (j.gap) o.gap = true;
      mentions.push(o);
      n++;
    }
    hits.set(j, n);
  }
  // a keyed surface is unlocated when it matched nowhere, not when a longer one took its place
  for (const j of jobs) if (!hits.get(j) && !j.derived) {
    const inLonger = jobs.some((k) => k !== j && k.id === j.id && hits.get(k) && k.sf.includes(j.sf));
    unlocated.push({ doc: docId, ent: j.id, cat: j.ent.cat, surface: j.raw, bare: j.sf,
      reason: NOT_IN_TEXT.has(j.ent.cat) ? "not in the model's text by design" : inLonger ? "only inside a longer surface" : "not found" });
  }
  mentions.sort((a, b) => a.s - b.s || a.e - b.e);
  return { mentions, unlocated, partly };
}

/* The split (PLAN.md 4.1): by genre, ids sorted within each genre, the 1st, 3rd,
   5th... to tune and the rest to test. */
function split(docs) {
  const byGenre = new Map();
  for (const d of docs) { if (!byGenre.has(d.genre)) byGenre.set(d.genre, []); byGenre.get(d.genre).push(d); }
  const cmp = (a, b) => a.id.localeCompare(b.id, "en", { numeric: true });
  const tune = new Set();
  for (const list of byGenre.values()) list.slice().sort(cmp).forEach((d, i) => { if (i % 2 === 0) tune.add(d.id); });
  return { tune: docs.filter((d) => tune.has(d.id)).map((d) => d.id), test: docs.filter((d) => !tune.has(d.id)).map((d) => d.id) };
}

/* "Added recall" (PLAN.md 3.1): tags every must mention of an entity that the
   model-off pipeline did not handle: missed, or found and still leaked (16 rows at
   v54 are found:true, leaked:true; counting only found:false under-counted what a
   model can add). Its rows (bench/results-no-model.json) are keyed by doc, cat and
   canonical; entOf maps a mention's ent id back to the key entity. */
function tagOffMissed(docs, rows, entOf) {
  const k = (doc, e) => doc + "\u0001" + e.cat + "\u0001" + e.canonical;
  const missed = new Set(rows.filter((r) => r.found === false || r.leaked === true).map((r) => k(r.doc, r)));
  let n = 0;
  for (const d of docs) for (const m of d.mentions) {
    const e = entOf(m.ent);
    if (m.must && e && missed.has(k(d.id, e))) { m.offMissed = true; n++; }
  }
  return n;
}

const textOf = (blocks) => blocks.map((b) => b.text).join("\n");
async function docText(file) {
  const raw = fs.readFileSync(path.isAbsolute(file) ? file : path.join(BENCH, file));
  return textOf(await engine().readBlocks(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)));
}

async function build(opts) {
  const o = opts || {};
  const key = o.key || JSON.parse(fs.readFileSync(path.join(BENCH, "key.json"), "utf8"));
  const rows = o.rows || JSON.parse(fs.readFileSync(path.join(BENCH, "results-no-model.json"), "utf8")).rows;
  const docs = [], unlocated = [], partlyClaimed = [];
  const entIndex = new Map();
  for (const d of key.docs) {
    const text = await docText(d.file);
    const r = locate(text, d.entities, d.id, GAPS.filter((g) => g.doc === d.id));
    d.entities.forEach((e, i) => entIndex.set(d.id + "#" + i, e));
    docs.push({ id: d.id, genre: d.genre, text, mentions: r.mentions });
    unlocated.push(...r.unlocated);
    partlyClaimed.push(...r.partly);
  }
  const offMissed = tagOffMissed(docs, rows, (id) => entIndex.get(id));
  const sp = split(key.docs);
  const set = (name, splitName, ids) => ({ name, source: "bench/key.json", licence: "repo", split: splitName,
    docs: ids ? docs.filter((d) => ids.includes(d.id)) : docs });
  const out = { tune: set("synthetic-tune", "tune", sp.tune), test: set("synthetic-test", "test", sp.test), all: set("synthetic-all", "all", null) };
  const count = (s) => {
    const ms = s.docs.flatMap((d) => d.mentions);
    const by = (f) => ms.filter(f).length;
    return { docs: s.docs.length, mentions: ms.length, must: by((m) => m.must), negatives: by((m) => !m.must),
      PER: by((m) => m.must && m.type === "PER"), ORG: by((m) => m.must && m.type === "ORG"), PLACE: by((m) => m.must && m.type === "PLACE"),
      offMissed: by((m) => m.offMissed), prefixed: by((m) => m.prefix), derived: by((m) => m.derived), gap: by((m) => m.gap) };
  };
  const derived = docs.flatMap((d) => d.mentions.filter((m) => m.derived || m.gap).map((m) => ({ doc: d.id, ent: m.ent, cat: m.cat, text: d.text.slice(m.s, m.e), s: m.s, gap: !!m.gap })));
  // entities with no mention at all, apart from the removed-by-design channels
  const located = new Set(docs.flatMap((d) => d.mentions.map((m) => m.ent)));
  const lostEntities = [...entIndex].filter(([id, e]) => e.kind !== "PII" && !located.has(id) && !NOT_IN_TEXT.has(e.cat)).map(([id, e]) => ({ ent: id, cat: e.cat, canonical: e.canonical }));
  const report = { generated: key.generated, split: sp, counts: { tune: count(out.tune), test: count(out.test), all: count(out.all) },
    offMissedMentions: offMissed, unlocated, partlyClaimed, lostEntities, added: derived };
  return { ...out, report };
}

function write(res, dir) {
  const d = dir || OUT;
  fs.mkdirSync(d, { recursive: true });
  const w = (f, o) => fs.writeFileSync(path.join(d, f), JSON.stringify(o, null, 1) + "\n");
  w("synthetic-tune.json", res.tune); w("synthetic-test.json", res.test); w("synthetic-all.json", res.all);
  w("synthetic-report.json", res.report);
  return d;
}

module.exports = { locate, split, tagOffMissed, build, write, bareSurface, surfaceRx, docText, GAPS, KIND_TYPE, TRAP_TYPE, SING, DBL, PFX_SET };

if (require.main === module) (async () => {
  const res = await build();
  const dir = write(res);
  const c = res.report.counts;
  console.log(`tune ${c.tune.docs} docs, ${c.tune.mentions} mentions (${c.tune.must} must, ${c.tune.negatives} negatives)`);
  console.log(`test ${c.test.docs} docs, ${c.test.mentions} mentions (${c.test.must} must, ${c.test.negatives} negatives)`);
  console.log(`all  ${c.all.docs} docs, ${c.all.mentions} mentions; PER ${c.all.PER}, ORG ${c.all.ORG}, PLACE ${c.all.PLACE}; offMissed ${c.all.offMissed}; with a prefix ${c.all.prefixed}`);
  const byReason = {};
  for (const u of res.report.unlocated) byReason[u.reason] = (byReason[u.reason] || 0) + 1;
  console.log("unlocated surfaces:", JSON.stringify(byReason));
  for (const u of res.report.unlocated.filter((x) => x.reason === "not found")) console.log(`  ${u.doc} ${u.cat} ${u.surface}`);
  console.log(`occurrences lost to an overlapping (not containing) claim: ${res.report.partlyClaimed.length}`);
  for (const p of res.report.partlyClaimed) console.log(`  ${p.doc} ${p.cat} ${p.surface} at ${p.s}`);
  for (const l of res.report.lostEntities) console.log(`  entity with no mention: ${l.ent} ${l.cat} ${l.canonical}`);
  console.log(`added beyond the key's surfaces: ${res.report.added.length}`);
  for (const a of res.report.added) console.log(`  ${a.doc} ${a.cat} ${a.text}${a.gap ? " (gap)" : " (name part)"}`);
  console.log("written to " + path.relative(path.join(BENCH, ".."), dir));
})().catch((e) => { console.error(e); process.exitCode = 1; });
