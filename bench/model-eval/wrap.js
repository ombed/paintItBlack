/* A registry model in the product's chain (product.js; PLAN.md 5.3 and run order 4).

   bench/lib.js modelSuggest reads a pipeline's raw output the way the page does: DictaBERT's
   BIO labels and type names. wrapPipe(pipe, spec) returns a pipeline-shaped function whose
   output is any model's tokens put through the same adapter predict.js uses, so the chain
   runs unchanged for every row. Two steps, as predict.js does them:
     - adapt, place the words with E.nerAlign, adapt again knowing where each sits (the
       SentencePiece adapter follows a detached piece by position);
     - PLACE back to GPE: the adapter's common type, and nerClean knows GPE/LOC/FAC only.
   Positions are dropped from the tokens handed back; modelSuggest places them again itself.
   wrapped.unmapped counts labels no map covered (a harness error, reported by product.js). */
const E = require("../engine.js");
const { adapt } = require("./adapters.js");
const { piecesOf } = require("./predict.js");

function wrapPipe(pipe, spec) {
  const wrapped = async (t, opt) => {
    let res = await pipe(t, opt);
    if (!Array.isArray(res)) res = res ? [res] : [];
    const pieces = spec.tokenizer === "sentencepiece" ? piecesOf(pipe, t) : null;
    const first = adapt(res, spec, { pieces });
    E.nerAlign(t, first.tokens, 0);
    const placed = res.map((r, i) => Object.assign({}, r, { _s: first.tokens[i]._s, _e: first.tokens[i]._e }));
    const a = adapt(placed, spec, { pieces });
    wrapped.unmapped += a.unmapped;
    return a.tokens.map((x) => {
      const y = Object.assign({}, x, { entity: String(x.entity).replace(/^([BI])-PLACE$/, "$1-GPE") });
      delete y._s; delete y._e;
      return y;
    });
  };
  wrapped.tokenizer = pipe.tokenizer;
  wrapped.unmapped = 0;
  return wrapped;
}

module.exports = { wrapPipe };
