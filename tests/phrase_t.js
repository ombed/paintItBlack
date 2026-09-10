/* A phrase she adds by hand is matched literally (Q13).

   Exact words, exact order, whole words only. The only tolerance is what
   the text itself varies: whitespace and the hyphen between words, and
   nikud. No prefix-letter variants for a phrase, no reordering, no partial
   matches inside longer words. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
const hitsOf = (text, value, kind) => {
  const eng = new C.Engine([{ value, kind: kind || "OTHER", replacement: "" }], [], OPT, text);
  return eng.detect(text).filter((h) => h.src === "list").map((h) => h.text);
};

console.log("\n— exact words, exact order —");
ok(hitsOf("הילדה לומדת שם. בית הספר הדמוקרטי נסגר.", "בית הספר הדמוקרטי").length === 1, "the phrase is found");
ok(hitsOf("הספר הדמוקרטי בית.", "בית הספר הדמוקרטי").length === 0, "another order is not the phrase");
ok(hitsOf("בית ספר דמוקרטי.", "בית הספר הדמוקרטי").length === 0, "a word missing is not the phrase");
ok(hitsOf("בית הספר הדמוקרטיים.", "בית הספר הדמוקרטי").length === 0, "the last word continued by letters is a different word");

console.log("\n— whole words —");
ok(hitsOf("הוא גר בגן.", "גן").length === 0 && hitsOf("הוא גר בגן.", "גן", "OTHER").length === 0, "a phrase never matches inside a longer word, prefix letter included");
ok(hitsOf("גן שעשועים גדול.", "גן").length === 1, "a whole word matches");
ok(hitsOf("הגן שלנו.", "גן").length === 0, "ה+גן is not גן for a phrase");
ok(hitsOf("מגניב.", "גן").length === 0, "inside a word: no");

console.log("\n— only whitespace, hyphen and nikud are normalised —");
ok(hitsOf("בית  הספר\nהדמוקרטי", "בית הספר הדמוקרטי").length === 1, "double space and line break");
ok(hitsOf("בית-הספר-הדמוקרטי", "בית הספר הדמוקרטי").length === 1, "hyphen between words");
ok(hitsOf("בֵּית הַסֵּפֶר הַדֵּמוֹקְרָטִי", "בית הספר הדמוקרטי").length === 1, "nikud");
ok(hitsOf("בית הספר הדמוקרטי", "בית הספר הדמוקראטי").length === 0, "a spelling variant is not the phrase");
ok(hitsOf("שרה’ס", "שרה'ס").length === 1, "typographic apostrophe equals a plain one");

console.log("\n— a name gets prefix forms, a phrase does not —");
ok(hitsOf("דיברתי עם לרונית לוי. ברונית לוי.", "רונית לוי", "NAME").length === 2, "a person: לרונית and ברונית are hers");
ok(hitsOf("לבית הספר הדמוקרטי.", "בית הספר הדמוקרטי", "OTHER").length === 0, "a phrase: ל+phrase is not the phrase");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
