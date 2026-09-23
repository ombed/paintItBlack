/* The product-chain wrapper (bench/model-eval/wrap.js): any registry model's labels put into
   the shape bench/lib.js modelSuggest and the engine read, DictaBERT's. Fake pipelines and
   invented text; no model. */
const E = require("../bench/engine.js");
const { wrapPipe } = require("../bench/model-eval/wrap.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// a pipeline that labels whole words from a lexicon, the way token-classification returns them
function fakePipe(lex) {
  const pipe = async (t) => (t.match(/[֐-׿\w]+|[^\s]/gu) || []).map((w, i) => ({ entity: lex[w] || "O", score: 0.95, index: i + 1, word: w }));
  pipe.tokenizer = { tokenize: (t) => t.split(/\s+/) };
  return pipe;
}
// what modelSuggest does with a pipeline's output
async function chain(pipe, text) {
  const res = await pipe(text, { ignore_labels: [] });
  E.nerAlign(text, res, 0);
  const ents = E.nerGroup(res).map((g) => ({ type: g.type, score: g.score, s: g.s, e: g.e }));
  return { ents, names: E.nerClean(ents, text).map((n) => n.kind + ":" + n.value).sort() };
}
const BIO = { labelScheme: "BIO", tokenizer: "wordpiece", labelMap: { PER: "PER", ORG: "ORG", GPE: "PLACE", LOC: "PLACE", FAC: "PLACE", TIMEX: null } };

(async () => {
  console.log("\n— DictaBERT's own scheme: the wrapper changes nothing —");
  {
    const text = "דוד כהן נסע לחיפה עם עמית לוי מחברת אורן תעשיות.";
    const lex = { "דוד": "B-PER", "כהן": "I-PER", "לחיפה": "B-GPE", "עמית": "B-PER", "לוי": "I-PER", "אורן": "B-ORG", "תעשיות": "I-ORG" };
    const raw = await chain(fakePipe(lex), text);
    const w = wrapPipe(fakePipe(lex), BIO);
    const wrapped = await chain(w, text);
    ok(JSON.stringify(wrapped.ents) === JSON.stringify(raw.ents), "the same spans: " + JSON.stringify(wrapped.ents.map((e) => text.slice(e.s, e.e) + "/" + e.type)));
    ok(wrapped.names.join() === raw.names.join() && raw.names.length === 4, "and the same cleaned names: " + wrapped.names.join(", "));
    ok(w.unmapped === 0, "nothing unmapped");
    const out = await w(text, {});
    ok(out.every((t) => t._s === undefined && t._e === undefined), "positions are left to modelSuggest");
    ok(out.some((t) => t.entity === "B-GPE") && !out.some((t) => /PLACE/.test(t.entity)), "a place goes back as GPE, the type nerClean knows");
    ok(w.tokenizer && typeof w.tokenizer.tokenize === "function", "the tokenizer is handed through (chunk-length checks)");
  }
  {
    // LOC right after GPE stays a second span, as the engine keeps raw DictaBERT labels
    const text = "גרנו בחיפה נווה שאנן";
    const lex = { "בחיפה": "B-GPE", "נווה": "I-LOC", "שאנן": "I-LOC" };
    const raw = await chain(fakePipe(lex), text), wrapped = await chain(wrapPipe(fakePipe(lex), BIO), text);
    ok(wrapped.ents.length === raw.ents.length, `GPE then I-LOC: ${wrapped.ents.length} spans, as unwrapped (${raw.ents.length})`);
  }

  console.log("\n— other schemes reach the engine as BIO —");
  {
    const text = "רונית אברהם גרה בנתניה.";
    const bioes = wrapPipe(fakePipe({ "רונית": "B-PER", "אברהם": "E-PER", "בנתניה": "S-GPE" }), { labelScheme: "BIOES", tokenizer: "wordpiece", labelMap: { PER: "PER", GPE: "PLACE" } });
    ok((await chain(bioes, text)).names.join() === "NAME:רונית אברהם,PLACE:נתניה", "BIOES: " + (await chain(bioes, text)).names.join(", "));
    const io = wrapPipe(fakePipe({ "רונית": "PER", "אברהם": "PER", "בנתניה": "GPE" }), { labelScheme: "IO", tokenizer: "wordpiece", labelMap: { PER: "PER", GPE: "PLACE" } });
    ok((await chain(io, text)).names.join() === "NAME:רונית אברהם,PLACE:נתניה", "IO, bare labels: " + (await chain(io, text)).names.join(", "));
    const golem = wrapPipe(fakePipe({ "רונית": "B-FIRST_NAME", "אברהם": "B-LAST_NAME", "בנתניה": "B-CITY" }),
      { labelScheme: "BIO", tokenizer: "wordpiece", labelMap: { FIRST_NAME: "PER", LAST_NAME: "PER", CITY: "PLACE" } });
    ok((await chain(golem, text)).names.join() === "NAME:רונית אברהם,PLACE:נתניה", "first and last name parts are one person: " + (await chain(golem, text)).names.join(", "));
  }

  console.log("\n— an unmapped label is counted, never guessed —");
  {
    const w = wrapPipe(fakePipe({ "רונית": "B-PER", "מחר": "B-WHEN" }), { labelScheme: "BIO", tokenizer: "wordpiece", labelMap: { PER: "PER" } });
    const r = await chain(w, "רונית תבוא מחר");
    ok(w.unmapped === 1, "one label with no mapping: " + w.unmapped);
    ok(r.names.join() === "NAME:רונית", "and it is dropped, not read as a name: " + r.names.join(", "));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
