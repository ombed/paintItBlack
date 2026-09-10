/* Omission: empty means gone, per kind and per entity.

   Until now the only choice was global, names only, and a number always
   became a bracketed label. She asked for numbers and dates to simply
   disappear, for one particular person to disappear, and for ages to stay.
   The style resolves in this order: the rule's own style, the per-kind
   default from the options, the global mode. Blank deletes the value and one
   neighbouring space, so the sentence reads as if it was never there. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const PAT_ON = new Set(C.PAT ? C.PAT.filter((p) => p.on).map((p) => p.n) : ["ISRAELI_ID", "DATE", "PHONE_MOBILE"]);
const base = (extra) => ({ on: PAT_ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", ...extra });

function run(text, subs, opt) {
  const eng = new C.Engine(subs, [], opt, text);
  return eng.detect(text).map((h) => ({ h, rep: eng.repFor(h) }));
}

console.log("\n— per-kind default: numbers and dates blank, people get names —");
{
  const txt = "נהוראי נולד ב-3.4.2017 ומספרו 314277062, טלפון 052-6613874.";
  const out = run(txt, [{ value: "נהוראי", kind: "NAME", replacement: "" }], base({ styles: { "*": "blank" } }));
  const by = (t) => out.find((x) => x.h.type === t);
  ok(by("NAME_ANCHORED") || out.some((x) => x.h.text === "נהוראי" && x.rep && x.rep !== ""), "the person gets a fake name");
  ok(by("DATE") && by("DATE").rep === "", "the date is blank");
  ok(by("ISRAELI_ID") && by("ISRAELI_ID").rep === "", "the identity number is blank");
  ok(by("PHONE_MOBILE") && by("PHONE_MOBILE").rep === "", "the phone is blank");
}

console.log("\n— a rule's own style wins over the default —");
{
  const txt = "אליעזר המתמלל רשם. אליעזר לוי נכח.";
  const out = run(txt, [
    { value: "אליעזר המתמלל", kind: "NAME", replacement: "", style: "blank" },
    { value: "אליעזר לוי", kind: "NAME", replacement: "" },
  ], base({}));
  const phrase = out.find((x) => x.h.text === "אליעזר המתמלל");
  const person = out.find((x) => x.h.text === "אליעזר לוי");
  ok(phrase && phrase.rep === "", "the phrase is blanked");
  ok(person && person.rep !== "" && !/^\[/.test(person.rep), "the other Eliezer keeps a fake name");
}
{
  const txt = "רונית לוי הגישה בקשה.";
  const out = run(txt, [{ value: "רונית לוי", kind: "NAME", replacement: "", style: "black" }], base({}));
  ok(out.length && out[0].rep === "███", "black is three blocks: " + JSON.stringify(out.map((x) => x.rep)));
}

console.log("\n— ages survive number omission —");
{
  const txt = "הילדה בת 9 והאח בן 12. הוא בגיל 7. עברו 3 שנים. מספר התיק 314277062.";
  const out = run(txt, [], base({ styles: { "*": "blank" } }));
  const texts = out.map((x) => x.h.text);
  for (const n of ["9", "12", "7", "3"]) ok(!texts.includes(n), "age " + n + " is never a hit");
  ok(texts.includes("314277062"), "the identity number still is");
}

console.log("\n— dates are found, short years too, but not section references —");
{
  const txt = "הדיון ב-11.2.2026 נדחה ל-3.6.26. לפי סעיף 7(ב) ותקנה 12.3 אין מניעה.";
  const out = run(txt, [], base({ styles: { "*": "blank" } }));
  const dates = out.filter((x) => x.h.type === "DATE").map((x) => x.h.text);
  ok(dates.includes("11.2.2026"), "full date found: " + JSON.stringify(dates));
  ok(dates.includes("3.6.26"), "two-digit year found");
  ok(!dates.includes("12.3"), "a two-part section number is not a date");
}

console.log("\n— the global mode still applies when nothing more specific does —");
{
  const txt = "רונית לוי הגישה בקשה.";
  const lab = run(txt, [{ value: "רונית לוי", kind: "NAME", replacement: "" }], base({ mode: "label" }));
  ok(lab.length && /^פלוני/.test(lab[0].rep), "label mode gives פלוני: " + (lab[0] && lab[0].rep));
  const blk = run(txt, [{ value: "רונית לוי", kind: "NAME", replacement: "" }], base({ mode: "block" }));
  ok(blk.length && blk[0].rep === "███", "block mode gives ███");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
