/* The public Hebrew gold sets (PLAN.md 4.3, FORMATS.md "Gold set"):
   node bench/model-eval/convert-public.js [--root DIR]

   Reads the raw files in public-bench/raw (see public-bench/SOURCES.md for where each
   came from) and writes public-bench/gold/{nemo-test,bmc-test1,knesset-ud}.json. The
   data never enters the repo; only this converter and the counts it prints do.

   Sets:
   - nemo-test: NEMO token-single, SPMRL version, test split (BIOES).
   - bmc-test1: BMC split 1, test (BIOES).
   - knesset-ud: UD_Hebrew-IAHLTknesset dev + test. NER is the MISC "Entity=" bracket
     annotation on syntactic words; a mention is widened to the whole surface tokens its
     words sit in (the prefix letter becomes part of it), which is how NEMO's token-level
     files draw it too. Sentences whose text also appears in the IAHLT NER open dataset
     are dropped, because joint/parse/iahlt may have trained on them.

   Labels: PER/PERS -> PER, ORG -> ORG, GPE/LOC/FAC -> PLACE; every other type (TTL,
   TIMEX, DATE, MONEY, WOA, ...) is dropped after decoding, so it never bleeds into a
   neighbour.

   Documents: Knesset UD by its newdoc units, read from the sent_id prefix because the
   newdoc lines are misplaced (see docOf). NEMO and BMC mark no article boundaries,
   so a document is a block of 20 consecutive sentences (the bootstrap unit; intervals
   on them are optimistic). Sentences are joined with "\n" in every set.

   Tokens -> text, the one rule applied to every set (DETOK_RULE below says it in words):
   the raw spacing is lost in NEMO and BMC, so Knesset UD is rebuilt by the same rule
   rather than from its "# text" line, and the share of Knesset sentences where the
   rule reproduces "# text" exactly is printed as a check on the rule. */
const fs = require("fs");
const path = require("path");

const DETOK_RULE = [
  "Tokens are joined with one space, except:",
  "1. no space before a token made only of closing punctuation , . : ; ? ! % ) ] } … (so '...' too);",
  "2. no space after an opening bracket ( [ {;",
  "3. a standalone quote token (\" ' ״ ׳) alternates open/close within a sentence, counted per quote character: an opening one takes no space after, a closing one no space before; “ is always opening, ” always closing;",
  "4. a standalone hyphen (- or maqaf ־) between two tokens that hold a letter or digit is glued on both sides (יושב-ראש, תל-אביב, ב-1990); the en and em dashes – — and a hyphen next to punctuation are spaced (in Knesset UD's own text 94 of 117 word-hyphen-word cases are glued and 44 of 45 en dashes are spaced);",
  "5. a token of Hebrew letters ending in a hyphen (ב-) is glued to the next token that holds a letter or digit;",
  "6. geresh and gershayim inside a token (ארה\"ב, ג'ורג', ש') are part of the token and never split or respaced.",
  "Sentences are joined with \"\\n\".",
].join(" ");

const CLOSE = /^[,.:;?!%)\]}\u2026]+$/;
const OPEN = /^[(\[{]+$/;
const QUOTE = new Set(['"', "'", "\u05F4", "\u05F3"]);
const HYPHEN = /^[-\u05BE]$/;
const isWord = (t) => t != null && /[\p{L}\p{N}]/u.test(t);

// One sentence of tokens -> its text and each token's [start, end).
function detok(tokens) {
  let text = "";
  const starts = [], ends = [], open = {};
  let glueNext = false;
  tokens.forEach((t, i) => {
    let before = i > 0 && !glueNext, after = false;
    if (CLOSE.test(t)) before = false;
    else if (OPEN.test(t)) after = true;
    else if (t === "\u201C") after = true;
    else if (t === "\u201D") before = false;
    else if (QUOTE.has(t)) {
      if (open[t]) { before = false; open[t] = false; } else { after = true; open[t] = true; }
    } else if (HYPHEN.test(t) && isWord(tokens[i - 1]) && isWord(tokens[i + 1])) { before = false; after = true; }
    else if (/^[א-ת]+[-־]$/.test(t) && isWord(tokens[i + 1])) after = true;
    if (before && i > 0) text += " ";
    starts.push(text.length); text += t; ends.push(text.length);
    glueNext = after;
  });
  return { text, starts, ends };
}

const TYPE = { PER: "PER", PERS: "PER", ORG: "ORG", GPE: "PLACE", LOC: "PLACE", FAC: "PLACE" };
// The types the three sets use that we drop on purpose. Anything else (a typo, a new
// release's type, "PERSON") is refused rather than silently lost.
const DROPPED = new Set(["TTL", "TIMEX", "MISC", "EVE", "WOA", "DUC", "ANG", "DATE", "TIME", "MONEY", "PERCENT", "NORP", "LANGUAGE", "LAW", "PRODUCT"]);
const mapType = (t) => {
  if (TYPE[t]) return TYPE[t];
  if (DROPPED.has(t)) return null;
  throw new Error("unmapped source type " + JSON.stringify(t));
};

// BMES/BIOES file -> sentences of { tokens, labels }. Blank lines end a sentence.
function readBmes(str) {
  const sents = [];
  let cur = null;
  for (const line of str.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) { if (cur) sents.push(cur); cur = null; continue; }
    const m = line.match(/^(.*\S)[ \t]+(\S+)$/);
    if (!m) throw new Error("unreadable BMES line " + JSON.stringify(line.replace(/[\u0590-\u05FF]/g, "x")));
    (cur = cur || { tokens: [], labels: [] }).tokens.push(m[1]);
    cur.labels.push(m[2]);
  }
  if (cur) sents.push(cur);
  return sents;
}

// BIOES (M counts as I) -> [{ i, j, type }] over token indices, j exclusive. A broken
// sequence (I/E with nothing open, or a type change) opens a new mention and is counted.
function decodeBioes(labels, stats = {}) {
  const out = [];
  let o = null;
  const close = (j) => { if (o) out.push({ i: o.i, j, type: o.type }); o = null; };
  labels.forEach((l, k) => {
    if (l === "O") { if (o) { stats.repaired = (stats.repaired || 0) + 1; close(k); } return; }
    const m = l.match(/^([BIMESU])-(.+)$/);
    if (!m) throw new Error("unknown label " + l);
    const [, p, type] = m;
    if (p === "B" || p === "S" || p === "U") { if (o) { stats.repaired = (stats.repaired || 0) + 1; close(k); } o = { i: k, type }; }
    else if (!o || o.type !== type) { stats.repaired = (stats.repaired || 0) + 1; close(k); o = { i: k, type }; }
    if (p === "E" || p === "S" || p === "U") close(k + 1);
  });
  if (o) { stats.repaired = (stats.repaired || 0) + 1; close(labels.length); }
  return out;
}

// CoNLL-U -> sentences of { sentId, newdoc, text, tokens (surface forms), spans }.
// Surface tokens are the multiword-token lines plus the words no range covers; a
// mention on syntactic words is widened to the surface tokens holding its first and last word.
function readConllu(str, stats = {}) {
  const sents = [];
  let cur = null, doc = null;
  const flush = () => {
    if (!cur) return;
    const tokOf = new Map(), tokens = [];
    let range = null;
    for (const r of cur.rows) {
      if (r.from != null) { range = r; tokens.push(r.form); continue; }
      if (range && r.id >= range.from && r.id <= range.to) { tokOf.set(r.id, tokens.length - 1); if (r.id === range.to) range = null; continue; }
      range = null; tokens.push(r.form); tokOf.set(r.id, tokens.length - 1);
    }
    const spans = [], stack = [];
    for (const r of cur.rows) {
      if (r.from != null || !r.entity) continue;
      for (const m of r.entity.matchAll(/\(([A-Za-z]+)\)|\(([A-Za-z]+)|([A-Za-z]+)\)/g)) {
        if (m[1]) spans.push({ a: r.id, b: r.id, type: m[1] });
        else if (m[2]) stack.push({ a: r.id, type: m[2] });
        else {
          let k = stack.length - 1;
          while (k >= 0 && stack[k].type !== m[3]) k--;
          if (k < 0) { stats.unmatchedBrackets = (stats.unmatchedBrackets || 0) + 1; continue; }
          spans.push({ a: stack[k].a, b: r.id, type: m[3] });
          stack.splice(k, 1);
        }
      }
    }
    stats.unmatchedBrackets = (stats.unmatchedBrackets || 0) + stack.length;
    sents.push({ sentId: cur.sentId, newdoc: cur.newdoc, text: cur.text, tokens,
      spans: spans.map((s) => ({ i: tokOf.get(s.a), j: tokOf.get(s.b) + 1, type: s.type })) });
    cur = null;
  };
  for (const line of str.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) { flush(); continue; }
    if (line[0] === "#") {
      const m = line.match(/^#\s*([^=]+?)\s*=\s?(.*)$/);
      if (!m) continue;
      if (m[1] === "newdoc id") doc = m[2];
      cur = cur || { rows: [], newdoc: doc };
      if (m[1] === "newdoc id") cur.newdoc = doc;
      if (m[1] === "sent_id") cur.sentId = m[2];
      if (m[1] === "text") cur.text = m[2];
      continue;
    }
    const f = line.split("\t");
    if (f.length !== 10) throw new Error("CoNLL-U line with " + f.length + " fields");
    cur = cur || { rows: [], newdoc: doc };
    if (f[0].includes(".")) continue; // empty nodes have no surface
    const ent = f[9].split("|").find((x) => x.startsWith("Entity="));
    if (f[0].includes("-")) { const [a, b] = f[0].split("-").map(Number); cur.rows.push({ from: a, to: b, form: f[1] }); }
    else cur.rows.push({ id: Number(f[0]), form: f[1], entity: ent ? ent.slice(7) : null });
  }
  flush();
  return sents;
}

// Sentences (tokens + token spans) -> one gold doc. Other types are dropped here, a
// mention inside another mapped mention is dropped (outer wins), and duplicates merge.
function makeDoc(id, genre, sents, stats) {
  let text = "";
  const mentions = [];
  sents.forEach((s, k) => {
    if (k) text += "\n";
    const d = detok(s.tokens), base = text.length;
    text += d.text;
    for (const sp of s.spans) {
      const type = mapType(sp.type);
      stats.orig[sp.type] = (stats.orig[sp.type] || 0) + 1;
      if (!type) continue;
      mentions.push({ s: base + d.starts[sp.i], e: base + d.ends[sp.j - 1], type, orig: sp.type });
    }
  });
  mentions.sort((a, b) => a.s - b.s || b.e - a.e);
  const kept = [];
  for (const m of mentions) {
    const last = kept[kept.length - 1];
    if (last && m.s === last.s && m.e === last.e && m.type === last.type) { stats.duplicates++; continue; }
    if (kept.some((o) => o.s <= m.s && m.e <= o.e)) { stats.nested++; continue; }
    kept.push(m);
  }
  return { id, genre, text, mentions: kept };
}

const newStats = () => ({ orig: {}, duplicates: 0, nested: 0, repaired: 0, unmatchedBrackets: 0 });

function blocks(sents, size) {
  const out = [];
  for (let k = 0; k < sents.length; k += size) out.push(sents.slice(k, k + size));
  return out;
}

// A BMES file -> docs of `block` sentences each.
function convertBmes(str, { prefix = "d", genre = "news", block = 20 } = {}) {
  const stats = newStats();
  const sents = readBmes(str).map((s) => ({ tokens: s.tokens, spans: decodeBioes(s.labels, stats) }));
  const docs = blocks(sents, block).map((b, k) => makeDoc(prefix + String(k + 1).padStart(3, "0"), genre, b, stats));
  return { docs, sents, stats };
}

// Text key for matching a sentence against another corpus: NFC, no nikud, one space.
const normText = (s) => s.normalize("NFC").replace(/[\u0591-\u05C7]/g, "").replace(/\s+/g, " ").trim();

// The document a sentence belongs to. Knesset UD's sent_ids are "<newdoc id>-<n>", but
// its "# newdoc id" lines sit on the wrong sentences (each file's first 26/37 sentences
// come before any newdoc line, and 68 sentences sit under another doc's marker), so the
// sent_id prefix is trusted first; the same 19 ids, each a contiguous run.
const docOf = (s) => { const m = s.sentId && s.sentId.match(/^(.+)-\d+$/); return m ? m[1] : s.newdoc || "doc"; };

// CoNLL-U strings -> docs by document (see docOf). `seen` is a Set of normText keys of sentences to
// drop, and `hay` an optional long string: a sentence of 5+ words found inside it is
// dropped too (it was annotated as part of a longer sample).
function convertConllu(strs, { genre = "knesset", seen = new Set(), hay = "" } = {}) {
  const stats = newStats();
  let sents = [];
  for (const s of [].concat(strs)) sents = sents.concat(readConllu(s, stats));
  const total = sents.length;
  let rebuilt = 0;
  const keep = sents.filter((s) => {
    if (s.text != null && detok(s.tokens).text === s.text) rebuilt++;
    const k = s.text != null ? normText(s.text) : null;
    return !(k && (seen.has(k) || (hay && k.split(" ").length >= 5 && hay.includes(k))));
  });
  // A newdoc id that comes back after another doc (the same id in dev and test) would
  // glue unrelated text into one bootstrap unit, so it is refused.
  const order = [], by = new Map();
  for (const s of keep) {
    const d = docOf(s);
    if (by.has(d) && order[order.length - 1] !== d) throw new Error("newdoc id repeats after another doc: " + d);
    if (!by.has(d)) { by.set(d, []); order.push(d); }
    by.get(d).push(s);
  }
  const docs = order.map((d) => makeDoc(d, genre, by.get(d), stats));
  const docsBefore = new Set(sents.map(docOf)).size;
  const newdocDisagrees = sents.filter((s) => s.newdoc && docOf(s) !== s.newdoc).length;
  return { docs, sents: keep, stats, total, dropped: total - keep.length, rebuilt, docsBefore, newdocDisagrees, withText: sents.filter((s) => s.text != null).length };
}

function counts(set, sents) {
  const per = { PER: 0, ORG: 0, PLACE: 0 };
  for (const d of set.docs) for (const m of d.mentions) per[m.type]++;
  let words = 0, tokens = 0;
  for (const s of sents) for (const t of s.tokens) { tokens++; if (isWord(t)) words++; }
  return { docs: set.docs.length, sentences: sents.length, tokens, words, mentions: per };
}

// Every mention must sit on token edges with no space at either end, and mentions in a
// doc are sorted and never overlap (the scorer matches one gold span per prediction).
function selfCheck(docs) {
  for (const d of docs) d.mentions.forEach((m, k) => {
    const t = d.text.slice(m.s, m.e);
    if (!t || t !== t.trim() || t.includes("\n") || m.s < 0 || m.e > d.text.length) throw new Error(`bad mention in ${d.id} at ${m.s}`);
    if (k && d.mentions[k - 1].e > m.s) throw new Error(`overlapping mentions in ${d.id} at ${m.s}`);
  });
}

// The raw files as fetched from the pinned commits (SOURCES.md). A changed file would
// silently change every public score, so it is refused.
const PINS = {
  "nemo_spmrl_token-single_gold_test.bmes": "6c0ebd10170d1197121cad86243161e99a130d448b91dad89959c90e0dbffe30",
  "bmc_split.test.1.bmes": "1cf77333e605f9ec0a88a2210ca64d18581fa68385e2eb27ec7444e7d1c4c827",
  "he_iahltknesset-ud-dev.conllu": "bea61498172719a6562a1a93e17c6c379ca44538b9337b5edb44ad2e86a6ecc4",
  "he_iahltknesset-ud-test.conllu": "9f646c1af22f58ca404be2be92481b3395683dfcb6d8cc31dbb4a530a6d3bd55",
  "iahlt_ner_unique_hebrew_samples_no_duplicates.jsonl": "d8566a86eeffdb0db60bf9481aef398e01bedf07c204773bd36b4da963ab6cba",
};
function checkSha(name, buf, pins = PINS) {
  const want = pins[name];
  if (!want) throw new Error("no pinned sha256 for " + name);
  const got = require("crypto").createHash("sha256").update(buf).digest("hex");
  if (got !== want) throw new Error(`sha256 mismatch for ${name}: got ${got}, pinned ${want}`);
}

// The public data must never land in the repo: refuse an output folder inside it.
const REPO = path.resolve(__dirname, "../..");
function checkOutside(dir, repo = REPO) {
  const rel = path.relative(path.resolve(repo), path.resolve(dir));
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) throw new Error("refusing to write public data inside the repo: " + dir);
}

const CONTAM = {
  "nemo-test": ["msperka-dicta", "aleph", "joint-base", "parse-base", "tiny-parse"],
  "bmc-test1": ["hebert"],
  "knesset-ud": ["joint-base", "parse-base", "tiny-parse"],
};

function main() {
  const a = process.argv.indexOf("--root");
  if (a > 0 && !process.argv[a + 1]) throw new Error("--root needs a folder");
  const ROOT = a > 0 ? process.argv[a + 1] : process.env.PUBLIC_BENCH || path.resolve(__dirname, "../../../public-bench");
  const RAW = path.join(ROOT, "raw"), OUT = path.join(ROOT, "gold");
  checkOutside(OUT);
  const read = (f) => { const buf = fs.readFileSync(path.join(RAW, f)); checkSha(f, buf); return buf.toString("utf8"); };
  fs.mkdirSync(OUT, { recursive: true });
  const write = (name, set) => { selfCheck(set.docs); fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(set, null, 1) + "\n"); };
  const report = (name, c, extra) => {
    console.log(`${name}: docs ${c.docs}, sentences ${c.sentences}, words ${c.words} (tokens ${c.tokens}), mentions PER ${c.mentions.PER} ORG ${c.mentions.ORG} PLACE ${c.mentions.PLACE}`);
    console.log("  source types: " + Object.entries(extra.orig).sort().map(([k, v]) => `${k} ${v}`).join(", "));
    console.log(`  repaired sequences ${extra.repaired}, nested dropped ${extra.nested}, duplicates merged ${extra.duplicates}, unmatched brackets ${extra.unmatchedBrackets}`);
  };

  const bmes = [
    { name: "nemo-test", file: "nemo_spmrl_token-single_gold_test.bmes", prefix: "n",
      source: "OnlpLab/NEMO-Corpus@38b10235a22998774311ab78a0078c8fb7dea57c data/spmrl/gold/token-single_gold_test.bmes",
      licence: "no data licence stated (guidelines CC-BY-4.0; the underlying Hebrew Treebank text is CC-BY-NC-SA-4.0 in UD_Hebrew-HTB)" },
    { name: "bmc-test1", file: "bmc_split.test.1.bmes", prefix: "b",
      source: "OnlpLab/HebrewResources@3213134010bb1e2c58b7ee3391e7b9c21d5b9209 BMCNER/splits/bmc_split.test.1.bmes",
      licence: "none stated" },
  ];
  for (const b of bmes) {
    const r = convertBmes(read(b.file), { prefix: b.prefix });
    const c = counts(r, r.sents);
    write(b.name, { name: b.name, source: b.source, licence: b.licence, split: "test", contamination: CONTAM[b.name],
      notes: "No article boundaries in the source: docs are blocks of 20 consecutive sentences (the last may be shorter), so bootstrap intervals on them are optimistic. Token-level labels: a mention covers whole tokens, prefix letters included. Offsets are UTF-16 indices, e exclusive. 'orig' is the source type.",
      detok: DETOK_RULE, counts: { ...c, sourceTypes: r.stats.orig, repairedSequences: r.stats.repaired }, docs: r.docs });
    report(b.name, c, r.stats);
  }

  // Sentences IAHLT NER also holds: exact match on normText, or 5+ words inside one of its samples.
  const seen = new Set(), texts = [];
  for (const l of read("iahlt_ner_unique_hebrew_samples_no_duplicates.jsonl").split("\n")) {
    if (!l.trim()) continue;
    const k = normText(JSON.parse(l).text || "");
    seen.add(k); texts.push(k);
  }
  const r = convertConllu([read("he_iahltknesset-ud-dev.conllu"), read("he_iahltknesset-ud-test.conllu")], { seen, hay: texts.join("\u0001") });
  const c = counts(r, r.sents);
  write("knesset-ud", { name: "knesset-ud", split: "dev+test", licence: "CC-BY-SA-4.0",
    source: "UniversalDependencies/UD_Hebrew-IAHLTknesset@e05de104dff1fd424b937678020a2f3e6d8458a0 he_iahltknesset-ud-{dev,test}.conllu (v2.18)",
    contamination: CONTAM["knesset-ud"],
    notes: `Docs are the documents of dev+test, taken from the sent_id prefix ("<doc>-<n>"), which gives the same ids as the newdoc lines; the newdoc lines themselves are misplaced (${r.newdocDisagrees} sentences sit under another doc's marker and each file starts before its first one). ${r.docsBefore} docs before the drop, ${c.docs} keep at least one sentence. ${r.dropped} of ${r.total} sentences dropped because their text is also in the IAHLT NER open dataset (exact match after NFC, nikud removal and space collapsing, or a 5+ word sentence inside a longer IAHLT sample). NER from MISC Entity= on syntactic words, widened to whole surface tokens (prefix letters included). TTL, TIMEX, MISC, EVE, WOA, DUC, ANG dropped. Text rebuilt by the detok rule, not taken from '# text'; the rule reproduces '# text' exactly for ${r.rebuilt} of ${r.withText} sentences. Offsets are UTF-16 indices, e exclusive. 'orig' is the source type.`,
    detok: DETOK_RULE, counts: { ...c, sourceTypes: r.stats.orig, droppedIahltOverlap: r.dropped, sentencesBeforeDrop: r.total, detokMatchesText: r.rebuilt },
    docs: r.docs });
  report("knesset-ud", c, r.stats);
  console.log(`  dropped as also in IAHLT NER: ${r.dropped} of ${r.total} sentences; detok reproduces '# text' for ${r.rebuilt}/${r.withText}`);
  console.log(`  docs ${r.docsBefore} before the drop (by sent_id prefix; ${r.newdocDisagrees} sentences sit under another doc's newdoc line)`);
  console.log("written to " + OUT);
}

module.exports = { DETOK_RULE, detok, mapType, readBmes, decodeBioes, readConllu, makeDoc, convertBmes, convertConllu, normText, selfCheck, checkSha, checkOutside, PINS };
if (require.main === module) main();
