/* The allow list and the prefix letter.

   "אל תחליף" on a value writes it to the allow list, and the allow list
   deliberately matches that value with one prefix letter in front, so that
   allowing "תל אביב" also keeps "בתל אביב". But ש is a prefix letter, so
   allowing "רון" also kept "שרון" — a different person — as ש plus רון. Nothing
   said so; שרון simply stayed in the document.

   The guard: a prefix expansion never fires when the whole prefixed token is
   itself a value on the list. "שרון" on the list is שרון, not ש+רון. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };

function apply(text, subs, allow) {
  const eng = new C.Engine(subs, allow, OPT, text);
  let out = text;
  const hits = eng.detect(text).sort((a, b) => b.s - a.s);
  for (const h of hits) out = out.slice(0, h.s) + (h.rep || "X") + out.slice(h.e);
  return { out, hits };
}

console.log("\n— allowing רון does not keep שרון —");
{
  const subs = [{ value: "רון", kind: "NAME", replacement: "יובל" }, { value: "שרון", kind: "NAME", replacement: "מיכל" }];
  const { out } = apply("רון ושרון באו יחד. שרון דיברה ורון שתק.", subs, ["רון"]);
  ok(out.includes("רון"), "רון is kept, as she asked");
  ok(!out.includes("שרון"), "שרון is still replaced: " + out);
  ok(out.includes("מיכל"), "with her own substitute");
}
{
  // the expansion itself still works where it should
  const subs = [{ value: "תל אביב", kind: "PLACE", replacement: "חיפה" }];
  const { out } = apply("נסענו לתל אביב ובתל אביב ירד גשם.", subs, ["תל אביב"]);
  ok(!out.includes("חיפה"), "allowing a place keeps its prefixed forms too: " + out);
}
{
  // allowing the prefixed person directly still works
  const subs = [{ value: "רון", kind: "NAME", replacement: "יובל" }, { value: "שרון", kind: "NAME", replacement: "מיכל" }];
  const { out } = apply("שרון דיברה ורון שתק.", subs, ["שרון"]);
  ok(out.includes("שרון"), "שרון kept when she is the one allowed");
  ok(!/(^|[^א-ת])רון([^א-ת]|$)/.test(out) || out.includes("יובל"), "and רון is still replaced: " + out);
}

{
  /* Review H8. "אל תחליף" on a place kept its rule beside the allowance, and the allowance knew
     15 of the 22 prefix forms the rules know, so "שבחיפה" was replaced after she had said not to.
     Every form the engine can write for a rule must be covered by the same value when allowed.
     The forms come from the engine's own variants(), not from a list typed here. */
  const subs = [{ value: "חיפה", kind: "PLACE", replacement: "אשדוד" }];
  const forms = [...new Set(C.variants("חיפה", "normal").map((v) => v[0]))];
  ok(forms.length >= 20, "the engine writes the prefix forms: " + forms.length);
  const missed = forms.filter((f) => apply("המשפחה גרה " + f + " מזה שנים.", subs, ["חיפה"]).out.includes("אשדוד"));
  ok(missed.length === 0, "an allowed place is kept in every prefix form; replaced anyway in: " + missed.join(" "));
  ok(apply("המשפחה גרה בחיפה.", subs, []).out.includes("אשדוד"), "and without the allowance the rule still works");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
