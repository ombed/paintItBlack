/* Typography shapes around a value. The user found, after three QA rounds, that a
   name inside quotation marks was never replaced: every test document wrote names
   plainly. This suite writes the same values in every shape real documents use —
   quotes of every kind, a prefix letter before the quote, brackets, dashes, maqaf,
   no-break spaces, direction marks, niqqud, a line break or tab inside, footnote
   digits, bullets — and checks three things for each: the value is found, it is
   replaced (nothing of it is left), and its occurrences can be shown in context.
   Numbers get the same treatment, including no space after the label.

   A new shape seen in a real document is one more line here, not one more bug. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const { SHAPES } = require("./shape-lib.js");
const OPT = { on: new Set(["NAME", "ORG", "PLACES"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };

function run(text, subs) {
  const eng = new C.Engine(subs, [], OPT, text);
  const hits = eng.detect(text);
  let out = text;
  for (const h of hits.slice().sort((a, b) => b.s - a.s)) out = out.slice(0, h.s) + eng.repFor(h) + out.slice(h.e);
  return { hits, out };
}

for (const [value, kind, parts] of [["רחל פרידמן", "NAME", ["רחל", "פרידמן"]], ["אלונים", "ORG", ["אלונים"]]]) {
  console.log(`\n— ${value} in every shape —`);
  for (const [name, f] of Object.entries(SHAPES)) {
    const t = f(value);
    const { hits, out } = run(t, [{ value, kind, replacement: kind === "NAME" ? "יעל כהן" : "ברושים" }]);
    ok(hits.length > 0, `${name}: not found in ${JSON.stringify(t)}`);
    ok(!parts.some((p) => out.includes(p)), `${name}: left in the text: ${JSON.stringify(out)}`);
    ok(C.examplesOf([{ part: "w", text: t }], value).length > 0, `${name}: no occurrence to show for ${JSON.stringify(t)}`);
  }
}

console.log("\n— the body layer never proposes a value with punctuation at its edge —");
for (const [name, f] of Object.entries(SHAPES)) {
  const t = ["שירה ברקוביץ: פתחתי.", f("רחל פרידמן"), "שירה ברקוביץ: " + f("רחל פרידמן")].join("\n");
  const got = C.bodyNames([{ part: "w", text: t }], new Set()).map((c) => c.value);
  const bad = got.filter((v) => /^[^א-ת]|[^א-ת'׳]$/.test(v));
  ok(!bad.length, `${name}: ${JSON.stringify(bad)}`);
}

console.log("\n— abbreviations stay whole —");
{
  const t = "עו\"ד רונן אלמליח וביה\"ס ו-ד\"ר כהן וג'ורג' הגיעו.";
  const { out } = run(t, [{ value: "רונן אלמליח", kind: "NAME", replacement: "יובל שמיר" }]);
  ok(out.includes("עו\"ד יובל שמיר") && out.includes("ביה\"ס") && out.includes("ד\"ר") && out.includes("ג'ורג'"), "abbreviations untouched: " + out);
}

console.log("\n— numbers, with and without a space after their label —");
{
  const NUM = { on: new Set(["ISRAELI_ID", "ISRAELI_ID_LABELED", "PHONE_MOBILE", "DATE", "PLATE"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
  const find = (t) => new C.Engine([], [], NUM, t).detect(t).map((h) => h.text);
  for (const [t, want] of [
    ["ת.ז 034567891 הוגשה", "034567891"], ["ת\"ז034567891", "034567891"], ["(034567891)", "034567891"],
    ["\"034567891\"", "034567891"], ["טל0528765432", "0528765432"], ["ביום14.3.2026", "14.3.2026"],
    ["ב-14.3.2026.", "14.3.2026"], ["רכב 12-345-67,", "12-345-67"],
  ]) ok(find(t).includes(want), `${JSON.stringify(t)} → ${want}: got ${JSON.stringify(find(t))}`);
  ok(!find("מספר 0345678912 ארוך").includes("034567891"), "ten digits are not an ID in their first nine");
  ok(!find("A034567891").length, "a Latin letter glued before digits is a code, not an ID");
}

// layer 1b: places get every shape, and a prefix letter in front of them
for (const [value, parts] of [["חיפה", ["חיפה"]], ["תל אביב", ["תל אביב", "אביב"]], ["קריית אתא", ["קריית", "אתא"]]]) {
  console.log(`\n— the place ${value} in every shape —`);
  const subs = [{ value, kind: "PLACE", replacement: "תקוע" }];
  for (const [name, f] of Object.entries(SHAPES)) {
    for (const pre of ["", "ב"]) {
      // a prefix letter goes on the place itself, not on the quote or bracket before it
      const t = pre ? f(value).replace(value, pre + value) : f(value);
      if (pre && (name.startsWith("prefix") || !t.includes(pre + value.split(" ")[0]))) continue;
      const { hits, out } = run(t, subs);
      const tag = `${name}${pre ? ", with " + pre : ""}`;
      ok(hits.length > 0, `${tag}: not found in ${JSON.stringify(t)}`);
      ok(!parts.some((p) => out.includes(p)), `${tag}: left in the text: ${JSON.stringify(out)}`);
      if (pre) ok(out.includes(pre + "תקוע"), `${tag}: the prefix letter is lost: ${JSON.stringify(out)}`);
    }
  }
}

// layer 1b: a model span on a value in every shape comes back as exactly the value, also
// when the model cut its first letter (it does, after swallowing a prefix letter)
console.log("\n— a model span on a value, in every shape, is cleaned to exactly the value —");
for (const [value, type] of [["מיכל ברנע", "PER"], ["חיפה", "LOC"], ["אלונים", "ORG"]]) {
  for (const [name, f] of Object.entries(SHAPES)) {
    // a name recurs: the second, plain mention is the evidence the cleaner uses to peel a prefix
    const t = f(value) + " ושוב " + value + ".", s = t.indexOf(value);
    if (s < 0) continue;
    for (const [how, a, b] of [["exact", s, s + value.length], ["first letter cut", s + 1, s + value.length]]) {
      const got = C.nerClean([{ type, score: 0.99, s: a, e: b }], t, {}).map((x) => x.value);
      ok(got.length === 1 && got[0] === value, `${value}, ${name}, ${how}: ${JSON.stringify(t)} gave ${JSON.stringify(got)}`);
    }
  }
}

// layer 1b: the AI answers in its own shapes, and the real name comes back from each
console.log("\n— the real name comes back from the AI answer in every shape —");
{
  const pairs = [["רחל פרידמן", "מיכל ברנע"], ["אלונים", "ברושים"]];
  const back = (t) => C.restoreNames(t, pairs).text;
  const RESHAPES = {
    ...SHAPES,
    "markdown bold": (x) => `המורה **${x}** אמרה.`,
    "markdown italic": (x) => `המורה *${x}* אמרה.`,
    "at the start of a line": (x) => `${x} אמרה.`,
    "a title before": (x) => `עו"ד ${x} אמרה.`,
    "prefix ל": (x) => `כתבתי ל${x} אתמול.`,
    "prefix וב": (x) => `ובדקתי וב${x} אתמול.`,
    "prefix ש": (x) => `אמרתי ש${x} צודקת.`,
    "prefix with maqaf": (x) => `כתבתי ל־${x} אתמול.`,
  };
  for (const [fake, real] of [["מיכל ברנע", "רחל פרידמן"], ["ברושים", "אלונים"]]) {
    for (const [name, f] of Object.entries(RESHAPES)) {
      const t = f(fake), out = back(t);
      ok(out.includes(real.split(" ").pop()) && !fake.split(" ").some((p) => out.includes(p)), `${fake}, ${name}: ${JSON.stringify(t)} came back as ${JSON.stringify(out)}`);
    }
  }
  ok(back("כתבתי למיכל ברנע.").includes("לרחל פרידמן"), "the prefix letter stays in front of the real name: " + back("כתבתי למיכל ברנע."));
  ok(back("ברנע אמרה.") === "פרידמן אמרה.", "the surname alone comes back as the surname: " + back("ברנע אמרה."));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
