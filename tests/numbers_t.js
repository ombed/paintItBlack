/* Numbers that look like the tool missed them.

   She reported that identifying numbers appear untouched in the output. Two
   separate causes, both silent.

   One: a nine-digit number whose check digit does not match was dropped by
   the detector outright — `if(p.v && !p.v(m[0])) continue`. Not replaced, not
   flagged, absent from the review list, no mark in the document. A mistyped
   or non-Israeli identity number therefore travelled to the AI intact with
   nothing to notice. A failing check digit is evidence of a typo, not
   evidence that the number is harmless, so it now goes to review instead.

   Two: anything left for review carried no mark in the document view, so it
   was pixel-identical to text nobody had touched. That is exactly what "the
   tool missed it" looks like. The preview now marks those spans too, and the
   check screen paints them in the warning colour. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const OPT = { on: new Set(["ISRAELI_ID"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
const hitsFor = (txt, on) => {
  const opt = { ...OPT, on: on || OPT.on };
  return new C.Engine([], [], opt, txt).detect(txt);
};

console.log("\n— a check digit that does not match goes to review, it does not vanish —");
{
  // 314277062 carries a valid Israeli check digit; 314277061 does not
  const good = hitsFor("המספר שלו 314277062 לפי הרישום").filter((h) => h.type === "ISRAELI_ID");
  ok(good.length === 1, "a valid identity number is found");
  ok(good.length === 1 && good[0].apply === true, "and is replaced");
  ok(good.length === 1 && !good[0].review, "without asking her");

  const badId = hitsFor("המספר שלו 314277061 לפי הרישום").filter((h) => h.type === "ISRAELI_ID");
  ok(badId.length === 1, "a nine-digit number with a bad check digit is still found");
  ok(badId.length === 1 && badId[0].apply === false, "it is not replaced on its own");
  ok(badId.length === 1 && badId[0].review === true, "it is raised for her decision");
  ok(badId.length === 1 && /ספרת הביקורת/.test(badId[0].why || ""), "and the reason says the check digit failed");
}
{
  // the labelled form never depended on the check digit, and must not regress
  const lab = hitsFor('ת"ז 314277061 של המבקשת', new Set(["ISRAELI_ID", "ISRAELI_ID_LABELED"]))
    .filter((h) => /ISRAELI_ID/.test(h.type));
  ok(lab.length > 0, "a labelled identity number is found whatever its check digit");
  ok(lab.some((h) => h.apply === true), "and at least one form of it is replaced outright");
}

console.log("\n— what a number turns into —");
{
  // numbers never become other numbers; they become a bracketed label, in
  // every mode. The guide and the interface both have to say so.
  const eng = new C.Engine([], [], OPT, "המספר שלו 314277062 לפי הרישום");
  const h = eng.detect("המספר שלו 314277062 לפי הרישום").find((x) => x.type === "ISRAELI_ID");
  const rep = eng.repFor(h);
  ok(typeof rep === "string" && rep.length > 0, "a replacement is produced");
  ok(/^\[/.test(rep) && /\]$/.test(rep), "it is a bracketed label, not another number: " + rep);
  ok(!/^\d+$/.test(rep), "it can never be mistaken for a real number");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
