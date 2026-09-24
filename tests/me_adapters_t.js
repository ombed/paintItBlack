/* The model-eval adapters (bench/model-eval/adapters.js): every label scheme and tokenizer
   shape is rewritten into the BIO + WordPiece shape the engine's nerAlign/nerGroup read.
   A wrong adapter makes a model look worse (or better) than it is with no error anywhere,
   so each scheme is pinned here with hand-made token lists, and most cases are checked all
   the way through the engine's own grouping, which is what the harness scores. */
const E = require("../bench/engine.js");
const { adapt, parse, mapType, spWord } = require("../bench/model-eval/adapters.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const DICTA = { labelScheme: "BIO", tokenizer: "wordpiece", labelMap: { PER: "PER", ORG: "ORG", GPE: "PLACE", LOC: "PLACE", FAC: "PLACE", TIMEX: null } };
// [word, label] pairs -> pipeline rows
const toks = (pairs) => pairs.map(([word, entity], i) => ({ word, entity, score: 0.9, index: i + 1 }));
const labels = (a) => a.tokens.map((t) => t.entity).join(" ");
// through the engine: align to the text, group, and read the spans back
function spans(text, pairs, spec, opt) {
  const a = adapt(toks(pairs), spec, opt);
  E.nerAlign(text, a.tokens, 0);
  return E.nerGroup(a.tokens).map((g) => text.slice(g.s, g.e) + "/" + g.type).join(" | ");
}

console.log("\n— labels are parsed with either separator, and a bare type is an inside tag —");
{
  ok(JSON.stringify(parse("B-PER")) === '{"pre":"B","type":"PER"}', "B-PER");
  ok(JSON.stringify(parse("B_PERS")) === '{"pre":"B","type":"PERS"}', "B_PERS: the underscore separator");
  ok(JSON.stringify(parse("I-FIRST_NAME")) === '{"pre":"I","type":"FIRST_NAME"}', "only the separator changes, not an underscore inside the type");
  ok(parse("O").pre === "O" && parse("O").type === null, "O");
  ok(JSON.stringify(parse("PER")) === '{"pre":"I","type":"PER"}', "IO without prefixes");
  ok(parse("LABEL_3").type === "LABEL_3", "a config without id2label: the whole label is the type (and unmapped)");
}

console.log("\n— types go through labelMap; null drops, a missing entry is unmapped —");
{
  ok(mapType("GPE", DICTA.labelMap) === "PLACE", "GPE -> PLACE");
  ok(mapType("TIMEX", DICTA.labelMap) === null, "a declared drop");
  ok(mapType("WOA", DICTA.labelMap) === undefined, "not in the map: unmapped");
  ok(mapType("PERS", {}) === "PER" && mapType("CITY", {}) === "PLACE" && mapType("STREET", {}) === "PLACE" && mapType("POSTAL_CODE", {}) === "PLACE", "the named aliases apply where the map is silent");
  ok(mapType("PERS", { PERS: null }) === null, "an explicit map entry wins over an alias");
  ok(mapType("PER", { PER: "NAME" }) === undefined, "a map to something that is not PER/ORG/PLACE is not a mapping");
  const a = adapt(toks([["דוד", "B-PER"], ["ביום", "B-TIMEX"], ["יצירה", "B-WOA"], ["שם", "I-WOA"]]), DICTA);
  ok(labels(a) === "B-PER O O O", "dropped and unmapped both become O: " + labels(a));
  ok(a.unmapped === 2 && a.unmappedNames.join() === "WOA", "only the unmapped ones are counted, by token: " + a.unmapped);
}

console.log("\n— BIO passes through, and keeps the engine's grouping —");
{
  const text = "דוד כהן גר בחיפה";
  const pairs = [["דוד", "B-PER"], ["כהן", "I-PER"], ["גר", "O"], ["בחיפה", "B-GPE"]];
  ok(labels(adapt(toks(pairs), DICTA)) === "B-PER I-PER O B-PLACE", "labels");
  ok(spans(text, pairs, DICTA) === "דוד כהן/PER | בחיפה/PLACE", spans(text, pairs, DICTA));
  // the engine continues only the same raw type; after the map both are PLACE, and must stay two
  const t2 = "ירושלים העתיקה";
  const p2 = [["ירושלים", "B-GPE"], ["העתיקה", "I-LOC"]];
  ok(labels(adapt(toks(p2), DICTA)) === "B-PLACE B-PLACE", "I-LOC after GPE starts a new span: " + labels(adapt(toks(p2), DICTA)));
  ok(spans(t2, p2, DICTA) === "ירושלים/PLACE | העתיקה/PLACE", spans(t2, p2, DICTA));
  const raw = toks(p2); E.nerAlign(t2, raw, 0);
  ok(E.nerGroup(raw).length === 2, "as the engine groups the raw labels");
  const input = toks(pairs), before = JSON.stringify(input);
  adapt(input, DICTA);
  ok(JSON.stringify(input) === before, "the pipeline's rows are not changed in place");
}

console.log("\n— a subword piece and a joining hyphen do not break a run —");
{
  // the model tags the first piece only; the rest come back O
  const IO = { labelScheme: "IO", tokenizer: "wordpiece", labelMap: { PER: "PER" } };
  const p = [["דו", "I-PER"], ["##ד", "O"], ["כהן", "I-PER"]];
  ok(labels(adapt(toks(p), IO)) === "B-PER O I-PER", "IO: the O on the piece does not end the run: " + labels(adapt(toks(p), IO)));
  ok(spans("דוד כהן", p, IO) === "דוד כהן/PER", spans("דוד כהן", p, IO));
  const h = [["תל", "B-GPE"], ["-", "O"], ["אביב", "I-GPE"]];
  ok(spans("תל-אביב", h, DICTA) === "תל-אביב/PLACE", "BIO: hyphenated place is one span: " + spans("תל-אביב", h, DICTA));
  const c = [["דוד", "I-PER"], [",", "I-PER"], ["משה", "I-PER"]];
  ok(spans("דוד, משה", c, IO) === "דוד/PER | משה/PER", "punctuation ends a run even when tagged: " + spans("דוד, משה", c, IO));
}

console.log("\n— BIOES: S -> B, E -> I, and a run closes at E —");
{
  const S = { labelScheme: "BIOES", tokenizer: "wordpiece", labelMap: { PER: "PER", LOC: "PLACE" } };
  const p = [["דוד", "S-PER"], ["ו", "O"], ["משה", "B-PER"], ["לוי", "E-PER"], ["רון", "I-PER"], ["חיפה", "S-LOC"]];
  ok(labels(adapt(toks(p), S)) === "B-PER O B-PER I-PER B-PER B-PLACE", labels(adapt(toks(p), S)));
  ok(spans("דוד ו משה לוי רון חיפה", p, S) === "דוד/PER | משה לוי/PER | רון/PER | חיפה/PLACE", spans("דוד ו משה לוי רון חיפה", p, S));
  const s2 = [["דוד", "S-PER"], ["כהן", "S-PER"]];
  ok(spans("דוד כהן", s2, S) === "דוד/PER | כהן/PER", "two singles stay two");
}

console.log("\n— IO and B_only: the first token of a run is B-, the rest I- —");
{
  const IO = { labelScheme: "IO", tokenizer: "wordpiece", labelMap: { PER: "PER", ORG: "ORG" } };
  const p = [["דוד", "I-PER"], ["כהן", "I-PER"], ["ו", "O"], ["משה", "PER"], ["בנק", "I-ORG"]];
  ok(labels(adapt(toks(p), IO)) === "B-PER I-PER O B-PER B-ORG", labels(adapt(toks(p), IO)));
  ok(spans("דוד כהן ו משה בנק", p, IO) === "דוד כהן/PER | משה/PER | בנק/ORG", spans("דוד כהן ו משה בנק", p, IO));
  const HB = { labelScheme: "B_only", tokenizer: "wordpiece", labelMap: { PERS: "PER", LOC: "PLACE", DATE: null } };
  const b = [["דוד", "B_PERS"], ["כהן", "B_PERS"], ["מחיפה", "B_LOC"], ["אתמול", "B_DATE"], ["רון", "B_PERS"]];
  ok(labels(adapt(toks(b), HB)) === "B-PER I-PER B-PLACE O B-PER", "B_ tags: " + labels(adapt(toks(b), HB)));
  ok(spans("דוד כהן מחיפה אתמול רון", b, HB) === "דוד כהן/PER | מחיפה/PLACE | רון/PER", spans("דוד כהן מחיפה אתמול רון", b, HB));
}

console.log("\n— IOB1: I is the default, B only splits two entities of one type —");
{
  const I1 = { labelScheme: "IOB1", tokenizer: "wordpiece", labelMap: { PER: "PER", ORG: "ORG" } };
  const p = [["דוד", "I-PER"], ["כהן", "I-PER"], ["משה", "B-PER"], ["בנק", "I-ORG"], ["לאומי", "I-ORG"]];
  ok(labels(adapt(toks(p), I1)) === "B-PER I-PER B-PER B-ORG I-ORG", labels(adapt(toks(p), I1)));
  ok(spans("דוד כהן משה בנק לאומי", p, I1) === "דוד כהן/PER | משה/PER | בנק לאומי/ORG", spans("דוד כהן משה בנק לאומי", p, I1));
}

console.log("\n— \"_\" separators, PERS, name parts and address parts —");
{
  const U = { labelScheme: "BIO", tokenizer: "wordpiece", labelMap: { PERS: "PER" } };
  const p = [["דוד", "B_PERS"], ["כהן", "I_PERS"]];
  ok(labels(adapt(toks(p), U)) === "B-PER I-PER", "B_PERS/I_PERS -> B-PER/I-PER");
  const G = { labelScheme: "BIO", tokenizer: "sentencepiece", labelMap: {} };
  const n = [["דוד", "B-FIRST_NAME"], ["כהן", "B-LAST_NAME"], ["גר", "O"], ["ברחוב", "B-STREET"], ["הרצל", "I-STREET"], ["בחיפה", "B-CITY"], ["3100", "B-POSTAL_CODE"]];
  const a = adapt(toks(n), { ...G, tokenizer: "wordpiece" });
  ok(labels(a) === "B-PER I-PER O B-PLACE I-PLACE B-PLACE B-PLACE", "adjacent name parts merge into one PER: " + labels(a));
  ok(a.unmapped === 0, "the aliases cover them, nothing unmapped");
  const W = { ...G, tokenizer: "wordpiece" };
  ok(spans("דוד כהן גר ברחוב הרצל בחיפה 3100", n, W) === "דוד כהן/PER | ברחוב הרצל/PLACE | בחיפה/PLACE | 3100/PLACE", spans("דוד כהן גר ברחוב הרצל בחיפה 3100", n, W));
  const two = [["דוד", "B-FIRST_NAME"], [",", "O"], ["כהן", "B-LAST_NAME"]];
  ok(spans("דוד, כהן", two, W) === "דוד/PER | כהן/PER", "not merged across punctuation: " + spans("דוד, כהן", two, W));
  const mix = [["דוד", "B-PER"], ["כהן", "B-LAST_NAME"]];
  ok(labels(adapt(toks(mix), { ...W, labelMap: { PER: "PER" } })) === "B-PER B-PER", "a plain PER is not a name part: only the parts merge");
}

console.log("\n— SentencePiece: a piece without \"▁\" continues the word before it —");
{
  const SP = { labelScheme: "BIO", tokenizer: "sentencepiece", labelMap: { PER: "PER" } };
  // decode() drops the "▁", so the pieces come from the tokenizer, by index
  const pieces = ["<s>", "▁דוד", "▁כה", "ן", "▁גר", "</s>"];
  const rows = [["דוד", "B-PER"], ["כה", "I-PER"], ["ן", "O"], ["גר", "O"]].map(([word, entity], i) => ({ word, entity, score: 0.9, index: i + 1 }));
  const a = adapt(rows, SP, { pieces });
  ok(a.tokens.map((t) => t.word).join(" ") === "דוד כה ##ן גר", "words: " + a.tokens.map((t) => t.word).join(" "));
  E.nerAlign("דוד כהן גר", a.tokens, 0);
  const g = E.nerGroup(a.tokens).map((x) => "דוד כהן גר".slice(x.s, x.e)).join("|");
  ok(g === "דוד כהן", "the piece is attached, the name is whole: " + g);
  ok(spWord({ index: 2, word: "דוד" }, ["<s>", "▁", "דוד"]) === "דוד", "after a lone ▁ the piece starts a word");
  ok(spWord({ index: 1, word: "דוד" }, ["<s>", "דוד"]) === "דוד", "right after <s> the piece starts a word");
  ok(spWord({ word: "▁דוד" }, null) === "דוד", "without pieces, a marker left in the word is still removed");
  const wp = adapt(toks([["##ן", "O"]]), DICTA);
  ok(wp.tokens[0].word === "##ן", "WordPiece words are left alone");
}

console.log("\n— a dropped or unmapped entity still swallows its pieces, as nerGroup does on the raw labels —");
{
  // on the raw labels "##ום" joins the open TIMEX entity; after the map TIMEX is O, and the
  // piece's own I-PER must not surface as a PER span on half a word
  const p = [["בי", "B-TIMEX"], ["##ום", "I-PER"], ["דוד", "I-PER"]];
  ok(labels(adapt(toks(p), DICTA)) === "O O B-PER", "the piece is O, the next word starts fresh: " + labels(adapt(toks(p), DICTA)));
  ok(spans("ביום דוד", p, DICTA) === "דוד/PER", spans("ביום דוד", p, DICTA));
  const raw = toks(p); E.nerAlign("ביום דוד", raw, 0);
  ok(E.nerGroup(raw).filter((g) => g.type === "PER").map((g) => g.s + ":" + g.e).join() === "5:8", "as the engine groups the raw labels");
  // WOA is not in this map: unmapped, counted, and still an open entity
  const u = [["כה", "B-WOA"], ["##ן", "B-ORG"], ["לוי", "I-ORG"]];
  const a = adapt(toks(u), DICTA);
  ok(labels(a) === "O O B-ORG" && a.unmapped === 1, "unmapped: " + labels(a) + ", " + a.unmapped);
  ok(spans("כהן לוי", u, DICTA) === "לוי/ORG", spans("כהן לוי", u, DICTA));
  const h = [["תל", "B-TIMEX"], ["-", "O"], ["אביב", "I-GPE"]];
  ok(spans("תל-אביב", h, DICTA) === "אביב/PLACE", "a hyphen joins the dropped entity, the place after it is its own: " + spans("תל-אביב", h, DICTA));
}

console.log("\n— with nerAlign's positions, the adapter follows nerGroup exactly —");
{
  // nikud between the pieces: since v56 nerAlign gives the mark to the piece before it, so "##ד"
  // touches the TIMEX and nerGroup attaches it (before, it sat one past, and was left detached)
  const text = "דוִד";
  const rows = toks([["דו", "B-TIMEX"], ["##ד", "B-PER"]]);
  E.nerAlign(text, rows, 0);
  ok(rows[0]._e === 3 && rows[1]._s === 3, "the mark belongs to the first piece, the second follows it: " + rows[0]._e + " " + rows[1]._s);
  ok(labels(adapt(rows, DICTA)) === "O O", "so the piece continues its word, as nerGroup has it: " + labels(adapt(rows, DICTA)));
  // a real gap between them: the piece is detached, and the adapter does not swallow it either
  const gap = "דו ד";
  const rows2 = toks([["דו", "B-TIMEX"], ["##ד", "B-PER"]]);
  E.nerAlign(gap, rows2, 0);
  const a = adapt(rows2, DICTA);
  ok(rows2[1]._s === 3 && labels(a) === "O B-PER", "a detached piece is not swallowed: " + labels(a));
  const blind = adapt(toks([["דו", "B-TIMEX"], ["##ד", "B-PER"]]), DICTA);
  ok(labels(blind) === "O O", "without positions it is assumed to touch");
  // a token nerAlign could not place ends the open entity (nerGroup: _s null -> cur = null)
  const r2 = toks([["בי", "B-TIMEX"], ["xx", "O"], ["##ום", "I-PER"]]);
  r2[0]._s = 0; r2[0]._e = 2; r2[1]._s = null; r2[2]._s = 2; r2[2]._e = 4;
  ok(labels(adapt(r2, DICTA)) === "O O B-PER", "after an unplaced token nothing is open: " + labels(adapt(r2, DICTA)));
}

console.log("\n— a scheme the adapters do not know is an error, not a guess —");
{
  let threw = false;
  try { adapt([], { labelScheme: "BILOU", labelMap: {} }); } catch (_) { threw = true; }
  ok(threw, "unknown labelScheme throws");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
