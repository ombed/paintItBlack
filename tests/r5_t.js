/* Release 5, engine side: what the client's third session showed (16.9, v35).

   - A rejected span went to the allow list and shielded a listed name inside
     it: her client's full name stayed in clear in section 1.
   - "same person" from a short or prefixed form inserted the full pseudonym
     at every occurrence and dropped the prefix letter.
   - "מרים להידחות": an infinitive after a first name was taken as a surname.
   - "טל:" as a phone label was replaced by a person's pseudonym.
   - A deleted street address left "מ," and the postal code behind. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const OPT = { on: new Set(["NAME", "PHONE_LAND", "ADDRESS_STREET", "ZIPCODE"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: { "*": "blank" } };

function apply(text, subs, allow, opt) {
  const eng = new C.Engine(subs, allow || [], opt || OPT, text);
  let out = text;
  const hits = eng.detect(text).sort((a, b) => b.s - a.s);
  for (const h of hits) out = out.slice(0, h.s) + eng.repFor(h) + out.slice(h.e);
  return out;
}

console.log("\n— an allow entry blocks only its own token, never a listed name inside a longer span —");
{
  const t = "לגב' מרים אלון אסולין (להלן: מרים) ביום. נפגשה הח\"מ עם מרים בביתה. למרים סדר יום.";
  const subs = [{ value: "מרים", kind: "NAME", replacement: "בתיה" }];
  const a = apply(t, subs, ["מרים אלון אסולין"]);
  ok(a.includes("בתיה אלון אסולין"), "the listed first name is replaced inside the rejected span: " + a);
  ok(!a.includes("מרים"), "no מרים left anywhere: " + a);
  const b = apply(t, subs, ["מרים"]);
  ok(!b.includes("בתיה"), "allowing the value itself still keeps it, prefixed forms included: " + b);
  const c = apply(t, subs, ["למרים"]);
  ok(c.includes("למרים סדר") && c.includes("עם בתיה"), "allowing one prefixed form keeps that form only: " + c);
}

console.log("\n— same person from a short or prefixed form takes the matching part of the pseudonym —");
{
  const t = "רן אלון הגיש בקשה. שרן אמר כך. רן אלון חתם.";
  const out = apply(t, [{ value: "רן אלון", kind: "NAME", replacement: "דניאל אשכנזי" }, { value: "שרן", kind: "NAME", replacement: "", sameAs: "רן אלון" }]);
  ok(out.includes("שדניאל אמר"), "שרן → ש + first name: " + out);
  ok(!out.includes("שדניאל אשכנזי"), "not the full pseudonym");
  const t2 = "יואב אלון הגיש בקשה. יואב אמר כך, וליואב יש טענות. אלון חתם.";
  const out2 = apply(t2, [{ value: "יואב אלון", kind: "NAME", replacement: "בועז גרינברג" }, { value: "יואב", kind: "NAME", replacement: "", sameAs: "יואב אלון" }]);
  ok(out2.includes("בועז אמר") && out2.includes("ולבועז יש"), "first name alone → first pseudonym, prefix kept: " + out2);
  const out3 = apply(t2, [{ value: "יואב אלון", kind: "NAME", replacement: "בועז גרינברג" }, { value: "אלון", kind: "NAME", replacement: "", sameAs: "יואב אלון" }]);
  ok(out3.includes("גרינברג חתם"), "surname alone → surname pseudonym: " + out3);
}

console.log("\n— an infinitive after a first name is not a surname —");
{
  const blocks = [
    { part: "w", text: "מהאמור לעיל סבורה הח\"מ כי דין הבקשה למינוי אפוטרופוס למרים להידחות. לא הובאו תימוכין." },
    { part: "w", text: "מרים ציינה כי היא מבינה. מרים חזרה על כך." },
    { part: "w", text: "המורה יעל לביא אמרה שהכול בסדר. יעל לביא הוסיפה דברים." },
  ];
  const got = C.bodyNames(blocks, new Set()).map((c) => c.value);
  ok(!got.includes("מרים להידחות"), "no מרים להידחות: " + got.join(", "));
  ok(got.includes("מרים"), "מרים alone is still found: " + got.join(", "));
  ok(got.includes("יעל לביא"), "a surname that starts with ל is kept: " + got.join(", "));
  ok(C.verbTail("להידחות") && C.verbTail("להגיש") && !C.verbTail("לביא") && !C.verbTail("לוי") && !C.verbTail("לנדאו"), "verbTail: infinitives yes, surnames no");
  // once מרים is listed, a suggestion containing it is not a new person
  const got2 = C.bodyNames(blocks, ["מרים"]).map((c) => c.value);
  ok(!got2.some((v) => /מרים/.test(v)), "no suggestion contains a listed value: " + got2.join(", "));
}

console.log("\n— a model span glued to an infinitive is trimmed —");
{
  const text = "דין הבקשה למינוי אפוטרופוס למרים להידחות. מרים ציינה.";
  const s = text.indexOf("למרים"), e = text.indexOf("להידחות") + "להידחות".length;
  const got = C.nerClean([{ type: "PER", score: 0.99, s, e }], text, {}).map((x) => x.value);
  ok(got.length === 1 && got[0] === "מרים", "PER span 'למרים להידחות' → מרים: " + JSON.stringify(got));
}

console.log("\n— טל: as a phone label is not the person טל —");
{
  const out = apply("טל: 04-8123456 פקס: 04-8123457\nטל: אני מסכימה לכך.", [{ value: "טל", kind: "NAME", replacement: "דניאל" }]);
  ok(out.startsWith("טל: "), "the label stays: " + out.split("\n")[0]);
  ok(out.includes("דניאל: אני מסכימה"), "the speaker turn is still replaced: " + out.split("\n")[1]);
}

console.log("\n— a deleted address takes its prefix letter and the postal code with it —");
{
  const out = apply("הנתבע גר מרחוב הגפן 12, חיפה 92149 ומשלם שכר דירה.", []);
  ok(!/מ\s*,/.test(out) && !out.includes("92149") && !out.includes("הגפן"), "no מ, and no postal code left: " + out);
  const lab = apply("גר ברחוב הגפן 12, חיפה.", [], [], { ...OPT, styles: { "*": "label" } });
  ok(lab.includes("ב[כתובת"), "with a label the letter stays in front: " + lab);
  const plain = apply("שילם 15000 ש\"ח ביום שלישי.", []);
  ok(plain.includes("15000"), "a five-digit amount without an address is untouched");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
