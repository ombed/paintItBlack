/* One document through one model, the way nerRun does it (engine/08-docx.js), with the
   adapter in the middle and the harness health counted (PLAN.md 3.1, FORMATS.md).

   predict(pipe, spec, text, opt) -> { raw, health, timing, unmappedNames }
     raw: [{s, e, type, score}] after adapter, E.nerAlign and E.nerGroup, before E.nerClean;
          types PER/ORG/PLACE; every span kept with its score (threshold 0)
     opt.chunk: nerChunks' limit, for the chunk-size rows (default: the engine's)
     opt.gold:  [{s, e}] gold mentions, to count alignment failures inside them

   cleaned(text, raw, opt) -> [{s, e, type, score}] per FORMATS.md: E.nerClean names, then
   every whole-word occurrence of each name, with the product's own matcher.

   Nothing here ever puts document text in an error, a count or a log line: a failing chunk
   is counted, not echoed, because transformers.js and ORT errors can carry the input. */
const E = require("../engine.js");
const { adapt } = require("./adapters.js");

const HEALTH = () => ({ unmappedLabels: 0, chunksOver510: 0, chunkErrors: 0,
  alignFailTokens: 0, alignFailEntityTokens: 0, entityTokens: 0, tokens: 0 });
const words = (text) => (String(text).match(/\S+/g) || []).length;

// token count without the special tokens; the pipeline truncates silently above 512 with them
function tokenCount(pipe, t) {
  const tk = pipe && pipe.tokenizer;
  if (!tk || typeof tk.tokenize !== "function") return null;
  return tk.tokenize(t).length;
}
// pieces by index, special tokens included, so they line up with the pipeline's token index
function piecesOf(pipe, t) {
  const tk = pipe && pipe.tokenizer;
  if (!tk || typeof tk.tokenize !== "function") return null;
  return tk.tokenize(t, { add_special_tokens: true });
}

/* A token nerAlign could not place has no position, so "inside a gold mention" is judged on
   the gap it must have come from: between the placed tokens before and after it. That can
   over-count a failure next to a mention, never under-count one inside it. */
function countAlignFails(toks, off, len, gold, health) {
  for (let i = 0; i < toks.length; i++) {
    if (toks[i]._s != null) {
      // the share's denominator: every token inside a gold mention, placed or not
      if (gold && gold.some((m) => m.s < toks[i]._e && m.e > toks[i]._s)) health.entityTokens++;
      continue;
    }
    health.alignFailTokens++;
    if (!gold || !gold.length) continue;
    let lo = off, hi = off + len;
    for (let j = i - 1; j >= 0; j--) if (toks[j]._s != null) { lo = toks[j]._e; break; }
    for (let j = i + 1; j < toks.length; j++) if (toks[j]._s != null) { hi = toks[j]._s; break; }
    if (gold.some((m) => m.s < Math.max(hi, lo + 1) && m.e > lo)) { health.alignFailEntityTokens++; health.entityTokens++; }
  }
}

async function predict(pipe, spec, text, opt) {
  const o = opt || {};
  const health = HEALTH();
  const unmappedNames = new Set();
  const raw = [];
  const t0 = Date.now();
  const chunks = o.chunk ? E.nerChunks(text, o.chunk) : E.nerChunks(text);
  for (const { t, off } of chunks) {
    try {
      const n = tokenCount(pipe, t);
      if (n != null && n > 510) health.chunksOver510++;
      let res = await pipe(t, { ignore_labels: [] });
      if (!Array.isArray(res)) res = res ? [res] : [];
      const pieces = spec.tokenizer === "sentencepiece" ? piecesOf(pipe, t) : null;
      // place the adapted words first, then adapt again knowing where each one sits, so the
      // adapter follows nerGroup through an unplaced token or a detached piece as it will
      const first = adapt(res, spec, { pieces });
      E.nerAlign(t, first.tokens, off);
      const placed = res.map((r, i) => Object.assign({}, r, { _s: first.tokens[i]._s, _e: first.tokens[i]._e }));
      const a = adapt(placed, spec, { pieces });
      health.unmappedLabels += a.unmapped;
      for (const x of a.unmappedNames) unmappedNames.add(x);
      health.tokens += a.tokens.length;
      E.nerAlign(t, a.tokens, off);
      countAlignFails(a.tokens, off, t.length, o.gold, health);
      for (const g of E.nerGroup(a.tokens)) raw.push({ s: g.s, e: g.e, type: g.type, score: g.score });
    } catch (_) {
      health.chunkErrors++;
    }
  }
  return { raw, health, timing: { scanMs: Date.now() - t0, words: words(text) }, unmappedNames: [...unmappedNames] };
}

// nerClean knows the engine's raw types; PLACE goes in as GPE, which it reads as PLACE too
const TO_ENGINE = { PER: "PER", ORG: "ORG", PLACE: "GPE" };
const FROM_KIND = { NAME: "PER", ORG: "ORG", PLACE: "PLACE" };

/* opt.min: nerClean's cut-off (the product's 0.6 when omitted). nerClean reads a 0 as "not
   given", so a cut-off of 0 is passed as the smallest positive number instead. */
function cleaned(text, raw, opt) {
  const min = opt && opt.min != null ? (opt.min > 0 ? opt.min : Number.MIN_VALUE) : undefined;
  const ents = raw.filter((r) => TO_ENGINE[r.type]).map((r) => ({ type: TO_ENGINE[r.type], score: r.score, s: r.s, e: r.e }));
  const names = E.nerClean(ents, text, min !== undefined ? { min } : undefined);
  const nd = E.norm(text); // same length as text: norm maps character for character
  const out = [], seen = new Set();
  for (const n of names) {
    const type = FROM_KIND[n.kind];
    if (!type || !n.value) continue;
    /* the forms the product itself replaces: the value, and each form with a prefix letter
       (E.variants, "normal", as a rule of kind NAME, ORG or PLACE gets). The span is the name
       without its prefix, as the gold keys it. A whole-word match alone missed "בחיפה". */
    for (const [form, pre] of E.variants(String(n.value), "normal")) {
      const rx = new RegExp(E.NW + E.flex(form) + E.NWE, "gu");
      for (const m of nd.matchAll(rx)) {
        if (!m[0].length) continue;
        const s = m.index + (pre ? pre.length : 0), e = m.index + m[0].length;
        const k = s + ":" + e + ":" + type;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ s, e, type, score: n.score });
      }
    }
  }
  return out.sort((a, b) => a.s - b.s || a.e - b.e);
}

module.exports = { predict, cleaned, countAlignFails, tokenCount, piecesOf, words, TO_ENGINE, FROM_KIND };
