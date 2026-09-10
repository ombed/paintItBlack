/* The merge suggestion on the people screen (Q12).

   Two spellings of one woman used to be merged silently by the engine when
   every word was one vowel letter apart. Her decision: a merge is suggested,
   with the reason, and never happens on its own. The engine merges only what
   carries sameAs; the signals are a function she can read. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const sig = (a, b) => C.mergeSignals(a, b);

console.log("\n— signals, each by name —");
ok(sig("שלוה ליבוביץ", "שלווה ליבוביץ").includes("כתיב מלא מול חסר"), "vowel letter: " + sig("שלוה ליבוביץ", "שלווה ליבוביץ"));
ok(sig("אורלי לוי-אבקסיס", "אורלי לוי אבקסיס").includes("מקף מול רווח"), "hyphen vs space");
ok(sig("כהן דנה", "דנה כהן").includes("אותן מילים בסדר אחר"), "word order");
ok(sig("רונית", "רונית לוי").includes("שם פרטי לבדו"), "first name alone");
ok(sig("לוי", "רונית לוי").includes("שם משפחה לבדו"), "surname alone");
ok(sig("דניאל קפלן", "דניאל בן קפלן").includes("חלק מהשם המלא"), "part of a triple name");
ok(sig("רונית לוי", "רונית לוי").length === 0, "identical: nothing");
ok(sig("רונית לוי", "דנה כהן").length === 0, "two people: nothing");
ok(sig("רונית לוי", "רונית כהן").length === 0, "same first name, different surname: nothing");
ok(sig("רון", "שרון לוי").length === 0, "a substring is not a signal");
ok(sig("גל", "גל לוי").length === 0, "a two-letter part is too short to suggest");
ok(sig("שרה", "שרון").length === 0, "two different names one letter apart are not merged");

console.log("\n— the engine merges only what she confirmed —");
{
  const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
  const text = "שלוה ליבוביץ מסרה. שלווה ליבוביץ הוסיפה.";
  const reps = (subs) => { const eng = new C.Engine(subs, [], OPT, text); return Object.fromEntries(eng.detect(text).map((h) => [h.base, eng.repFor(h)])); };
  const r1 = reps([{ value: "שלוה ליבוביץ", kind: "NAME", replacement: "" }, { value: "שלווה ליבוביץ", kind: "NAME", replacement: "" }]);
  ok(r1["שלוה ליבוביץ"] !== r1["שלווה ליבוביץ"], "no sameAs: two names");
  const r2 = reps([{ value: "שלוה ליבוביץ", kind: "NAME", replacement: "", sameAs: "שלווה ליבוביץ" }, { value: "שלווה ליבוביץ", kind: "NAME", replacement: "" }]);
  ok(r2["שלוה ליבוביץ"] === r2["שלווה ליבוביץ"], "sameAs: one name for both: " + r2["שלוה ליבוביץ"]);
  // a chain: A sameAs B, B sameAs C → all three share
  const t3 = "דנה כהן. כהן דנה. דנה כהן-לוי.";
  const eng = new C.Engine([{ value: "דנה כהן-לוי", kind: "NAME", replacement: "" }, { value: "כהן דנה", kind: "NAME", replacement: "", sameAs: "דנה כהן" }, { value: "דנה כהן", kind: "NAME", replacement: "", sameAs: "דנה כהן-לוי" }], [], OPT, t3);
  const r3 = Object.fromEntries(eng.detect(t3).map((h) => [h.base, eng.repFor(h)]));
  ok(new Set(Object.values(r3)).size === 1, "a chain resolves to one name: " + JSON.stringify(r3));
  // the surname part still follows the full name (a part, not a merge)
  const t4 = "תמר גולדשמיט. גולדשמיט.";
  const eng4 = new C.Engine([{ value: "תמר גולדשמיט", kind: "NAME", replacement: "" }, { value: "גולדשמיט", kind: "NAME", replacement: "" }], [], OPT, t4);
  const r4 = Object.fromEntries(eng4.detect(t4).map((h) => [h.base, eng4.repFor(h)]));
  ok(r4["גולדשמיט"] && r4["תמר גולדשמיט"] && r4["תמר גולדשמיט"].endsWith(r4["גולדשמיט"]), "surname alone follows the full name: " + JSON.stringify(r4));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
