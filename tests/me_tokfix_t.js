/* The faithful tokenizer rewrite (bench/model-eval/tokfix.js) and the parity comparison
   (tok-parity.js agree). Offline: patterns and invented text only, no tokenizer files. */
const { faithfulPattern, faithfulTokJSON } = require("../bench/model-eval/tokfix.js");
const { agree } = require("../bench/model-eval/tok-parity.js");
const E = require("../bench/engine.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const throws = (f, m) => { let t = false; try { f(); } catch (_) { t = true; } ok(t, m); };
const W = String.raw`\p{L}\p{M}\p{Nd}\p{Pc}`;
// how a Split pre-tokenizer cuts: every match of the pattern, as transformers.js runs it
const cut = (p, s) => [...s.matchAll(new RegExp(p, "gu"))].map((m) => m[0]);

console.log("\n— the rewrite —");
ok(faithfulPattern(String.raw`\w+`) === `[${W}]+`, "\\w outside a class becomes the Unicode class");
ok(faithfulPattern(String.raw`[^\w\s]+`) === `[^${W}\\s]+`, "\\w inside a class is written out in place");
ok(faithfulPattern(String.raw`\W`) === `[^${W}]`, "\\W outside a class becomes the negated class");
throws(() => faithfulPattern(String.raw`[\W]`), "\\W inside a class is refused, not guessed");
ok(faithfulPattern(String.raw`\[UNK\]|\p{P}|\\w`) === String.raw`\[UNK\]|\p{P}|\\w`, "escaped brackets, \\p{..} and an escaped backslash stay as they are");
ok(faithfulPattern(String.raw`[\]\w]`) === `[\\]${W}]`, "an escaped ] does not end the class");
ok(faithfulPattern("א-ת") === "א-ת", "a pattern without \\w is unchanged");

console.log("\n— what it changes, on DictaBERT's last three branches —");
{
  const tail = String.raw`\w+|\p{P}|[^\w\s]+`;
  const js = cut(tail, "ביום שלישי.");
  ok(js.join("|") === "ביום|שלישי.", "under JS \\w a Hebrew word and its full stop are one piece: " + js.join("|"));
  const fx = cut(faithfulPattern(tail), "ביום שלישי.");
  ok(fx.join("|") === "ביום|שלישי|.", "faithful: the word and the full stop apart, as Python cuts it: " + fx.join("|"));
  ok(cut(faithfulPattern(tail), "(דנה)").join("|") === "(|דנה|)", "a name in brackets stands alone");
  // a leading bracket or quote is taken by \p{P} first either way; only what follows the word is glued
  ok(cut(tail, "(דנה)").join("|") === "(|דנה)", "under JS \\w only the closing bracket is glued");
  // the case that reaches names: a double surname or a maqaf compound is one piece, so its second
  // half reaches the model as a continuation piece (##...)
  ok(cut(tail, "מלכה-אזולאי").join("|") === "מלכה-אזולאי", "under JS \\w a hyphenated surname is one piece");
  ok(cut(faithfulPattern(tail), "מלכה-אזולאי").join("|") === "מלכה|-|אזולאי", "faithful: its halves and the hyphen apart");
  ok(cut(faithfulPattern(tail), "בן־יהודה").join("|") === "בן|־|יהודה", "and a maqaf the same");
  ok(cut(faithfulPattern(tail), "Dana Katz, 2020.").join("|") === cut(tail, "Dana Katz, 2020.").join("|"), "ASCII text cuts the same both ways");
  ok(cut(faithfulPattern(tail), "שָׁלוֹם").join("|") === "שָׁלוֹם", "nikud marks stay inside the word (\\p{M})");
}

console.log("\n— the whole file —");
{
  // an invented tokenizer.json: one pattern the page must repair (\" does not compile with u), one with \w
  const tok = { normalizer: { type: "Replace", pattern: { Regex: "[^א-ת]+" }, content: "[UNK]" },
    pre_tokenizer: { type: "Split", pattern: { Regex: String.raw`\w*[א-ת]\"[א-ת]\w*|\w+|\p{P}|[^\w\s]+` } } };
  const out = JSON.parse(faithfulTokJSON(JSON.stringify(tok), E));
  const p = out.pre_tokenizer.pattern.Regex;
  let compiles = true;
  try { new RegExp(p, "gu"); } catch (_) { compiles = false; }
  ok(compiles, "the result compiles with the u flag, no wrapper needed");
  ok(!p.includes(String.raw`\w`) && p.includes(W), "no \\w is left");
  ok(cut(p, 'עו"ד דנה.').join("|") === 'עו"ד|דנה|.', "an abbreviation with gershayim stays one piece, the full stop apart: " + cut(p, 'עו"ד דנה.').join("|"));
  ok(out.normalizer.pattern.Regex === "[^א-ת]+", "a pattern without \\w is left alone");
}

console.log("\n— agree() —");
{
  const a = agree([[1, 2], [3, 4], [5]], [[1, 2], [3, 9], [5]]);
  ok(a.equal === 2 && a.of === 3 && a.differ.join() === "2" && a.first.sentence === 2, "counts the equal sentences and names the first that differs");
  ok(agree([[1]], [[1]]).first === null, "no difference: no first");
  ok(agree({ error: "TypeError" }, [[1]]).error === "reference TypeError", "a reference that failed is an error, not a match");
  ok(agree([[1]], { error: "SyntaxError" }).error === "SyntaxError", "a tokenizer that does not load is reported as such");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
