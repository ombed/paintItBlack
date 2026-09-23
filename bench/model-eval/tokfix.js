/* The tokenizer as the model was trained with it, for DictaBERT-family tokenizers under
   transformers.js (found by tok-parity.js; docs/model-eval/RESULTS.md).

   faithfulPattern(p)        one pattern with \w and \W written out as Unicode classes
   faithfulTokJSON(txt, E)   a tokenizer.json through the page's fixTokJSON, then every pattern
                             made faithful; E is bench/engine.js */
/* \w and \W in a tokenizer pattern mean Unicode word characters in the Rust tokenizers library
   (Oniguruma: letters, marks, decimal digits, connectors), and ASCII only in a JS RegExp even
   with the u flag. So under JS a Hebrew word is not \w: DictaBERT's pre-tokenizer then takes it
   with its last branch, [^\w\s]+, together with the punctuation beside it. faithfulPattern writes
   \w and \W out as the Unicode classes, inside and outside a character class. */
const W = "\\p{L}\\p{M}\\p{Nd}\\p{Pc}";
function faithfulPattern(p) {
  let out = "", inClass = false;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) {
      const n = p[i + 1];
      if (n === "w") out += inClass ? W : "[" + W + "]";
      else if (n === "W") {
        // a negated \W inside a class cannot be written as one range; no DictaBERT pattern has it
        if (inClass) throw new Error("\\W inside a character class is not handled");
        out += "[^" + W + "]";
      } else out += c + n;
      i++;
      continue;
    }
    if (c === "[" && !inClass) inClass = true;
    else if (c === "]" && inClass) inClass = false;
    out += c;
  }
  return out;
}
// fixTokJSON (the page's repair), then every pattern made faithful; the Hebrew log line muted
function faithfulTokJSON(txt, E) {
  const log = console.log;
  console.log = () => {};
  let fixed;
  try { fixed = E.fixTokJSON(txt); } finally { console.log = log; }
  const j = JSON.parse(fixed);
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      if (typeof o[k] === "string" && (k === "Regex" || k === "pattern")) o[k] = faithfulPattern(o[k]);
      else walk(o[k]);
    }
  })(j);
  return JSON.stringify(j);
}

// the files a tokenizer folder may hold; a rewritten copy takes them all
const TOK_FILES = ["tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt", "config.json",
  "sentencepiece.bpe.model", "tokenizer.model", "added_tokens.json"];

module.exports = { faithfulPattern, faithfulTokJSON, W, TOK_FILES };
