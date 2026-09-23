/* Adapters: any model's token output -> what E.nerAlign / E.nerGroup expect (PLAN.md 5.3).

   The engine was written for DictaBERT: WordPiece words with "##" continuation pieces, and
   BIO labels "B-TYPE"/"I-TYPE". Every other model is rewritten into that shape here, token by
   token, so the engine's own align/group code runs unchanged for every row:

     - labels: "_" separator -> "-" (B_PERS), BIOES (S->B, E->I), IO and B_only (first token
       of a run -> B-, the rest I-), IOB1 -> BIO;
     - types through the registry's labelMap to PER/ORG/PLACE; null = a declared drop (becomes
       O); a type with no mapping is counted as unmapped and dropped, never guessed;
     - a few type aliases the task names (PERS, FIRST_NAME/LAST_NAME, CITY/STREET/POSTAL_CODE)
       apply only where labelMap is silent; adjacent name parts merge into one PER;
     - SentencePiece: a piece without the leading "▁" becomes "##piece", so nerGroup's
       subword rule attaches it to the word it continues.

   An I- label whose raw type differs from the run it follows becomes B-. That is what the
   engine does with DictaBERT's raw labels (it continues only the same type), and it keeps
   GPE followed by I-LOC as two spans after both map to PLACE. The run is tracked the way
   nerGroup tracks its open entity: "##" pieces and a joining hyphen are transparent,
   punctuation and O close it. */

const SCHEMES = new Set(["BIO", "BIOES", "IO", "B_only", "IOB1"]);
const TARGETS = new Set(["PER", "ORG", "PLACE"]);
// fallbacks only: an explicit labelMap entry always wins
const ALIASES = { PERS: "PER", PERSON: "PER", FIRST_NAME: "PER", LAST_NAME: "PER",
  CITY: "PLACE", STREET: "PLACE", POSTAL_CODE: "PLACE" };
// name parts: a first name next to a last name is one person, not two
const NAME_PARTS = new Set(["FIRST_NAME", "LAST_NAME", "FIRSTNAME", "LASTNAME", "GIVENNAME", "SURNAME", "MIDDLE_NAME"]);
const NAMEPART = "\u0000name";
const DROP = "\u0000drop"; // an entity the map drops (null) or cannot map
// prefixes that close the run in BIOES/BILOU, so a following I- starts a new entity
const CLOSERS = new Set(["E", "S", "L", "U"]);
const SPECIAL = /^(?:<[^>]*>|\[[A-Z]+\])$/;

// "B-PER", "B_PERS", "S-LOC" -> {pre, type}; a bare "PER" (IO without prefixes) -> I
function parse(label) {
  const l = String(label == null ? "O" : label);
  if (l === "O" || l === "") return { pre: "O", type: null };
  const m = /^([BIESLU])[-_](.+)$/.exec(l);
  if (m) return { pre: m[1], type: m[2] };
  return { pre: "I", type: l };
}

// -> "PER"/"ORG"/"PLACE", null (declared drop), or undefined (unmapped)
function mapType(type, labelMap) {
  const map = labelMap || {};
  if (Object.prototype.hasOwnProperty.call(map, type)) {
    const v = map[type];
    return v === null || TARGETS.has(v) ? v : undefined;
  }
  return ALIASES[type];
}

// the word nerAlign should search for, from the SentencePiece piece at this token's index
function spWord(t, pieces) {
  const p = pieces && t.index != null ? pieces[t.index] : null;
  if (p == null) { const w = String(t.word == null ? "" : t.word); return w.startsWith("▁") ? w.slice(1) : w; }
  if (p.startsWith("▁")) return p.slice(1);
  const prev = t.index > 0 ? pieces[t.index - 1] : null;
  // after a lone "▁" or a special token the piece starts a word even without its own marker
  if (prev == null || prev === "▁" || SPECIAL.test(prev)) return p;
  return "##" + p;
}

/* tokens: the pipeline's rows ({entity, score, index, word}); spec: a registry entry;
   opt.pieces: the tokenizer's pieces by index, with special tokens (SentencePiece only).
   Rows that already carry nerAlign's _s/_e (predict.js aligns first) are followed exactly as
   nerGroup will: an unplaced token (_s null) ends the entity, a piece that does not touch
   it is not attached. Without positions the text is assumed to run on.
   Returns new rows (the input is not touched) and the count of unmapped entity tokens. */
function adapt(tokens, spec, opt) {
  const scheme = (spec && spec.labelScheme) || "BIO";
  if (!SCHEMES.has(scheme)) throw new Error("unknown labelScheme: " + scheme);
  const map = (spec && spec.labelMap) || {};
  const sp = spec && spec.tokenizer === "sentencepiece";
  const pieces = (opt && opt.pieces) || null;
  const out = [];
  const unmappedNames = new Set();
  let unmapped = 0;
  let open = null; // key of the entity nerGroup most likely has open
  let run = null;  // key an I- label continues (null after E-/S- in BIOES)
  let end = null;  // where that entity ends in the text, when the rows carry nerAlign's _s/_e
  for (const t0 of tokens || []) {
    const t = Object.assign({}, t0);
    if (sp) t.word = spWord(t0, pieces);
    const w = String(t.word != null ? t.word : t.token != null ? t.token : t.text != null ? t.text : "");
    const sub = /^##/.test(w), core = w.replace(/^##/, "");
    const hyphen = /^[-־–]$/.test(core), wordish = /[֐-׿\w]/u.test(core);
    const { pre, type } = parse(t0.entity_group != null ? t0.entity_group : t0.entity);
    let target = null, key = null;
    if (type !== null) {
      const m = mapType(type, map);
      if (m === undefined) { unmapped++; unmappedNames.add(type); }
      else if (m !== null) { target = m; key = NAME_PARTS.has(type) && m === "PER" ? NAMEPART : type; }
    }
    // nerGroup attaches a "##" piece or a joining hyphen to the open entity whatever its label,
    // when it touches it (checked when a first nerAlign pass gave positions)
    const absorbed = open !== null && (sub || hyphen) && (t._s == null || end == null || t._s <= end);
    let label = "O";
    // a piece swallowed by a dropped entity is part of it: on the raw labels it can never
    // start a span of its own, so it must not start one here either
    if (target && !(absorbed && open === DROP)) {
      let begin;
      if (scheme === "IO" || scheme === "B_only") begin = run !== key;
      else if (pre === "B" || pre === "S" || pre === "U") begin = !(key === NAMEPART && run === NAMEPART);
      else begin = run !== key; // I, E, L continue only a run of the same raw type
      label = (begin ? "B-" : "I-") + target;
    }
    delete t.entity_group;
    t.entity = label;
    out.push(t);
    // a token nerAlign could not place ends nerGroup's open entity
    if (t._s === null) { open = run = end = null; continue; }
    if (absorbed) { if (end != null && t._e != null) end = Math.max(end, t._e); continue; }
    if (!wordish || type === null) { open = run = end = null; continue; }
    end = t._s != null ? t._e : null;
    // a dropped or unmapped entity is still an open entity to nerGroup on the raw labels
    if (!target) { open = run = DROP; continue; }
    open = key;
    run = scheme === "BIOES" && CLOSERS.has(pre) ? null : key;
  }
  return { tokens: out, unmapped, unmappedNames: [...unmappedNames] };
}

module.exports = { adapt, parse, mapType, spWord, SCHEMES, ALIASES, NAME_PARTS };
