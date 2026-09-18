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

const SHAPES = {
  plain: (x) => `המורה ${x} אמרה.`,
  "double quotes": (x) => `המורה "${x}" אמרה.`,
  "prefix + double quotes": (x) => `נפגשתי ב"${x}" אתמול.`,
  "single quotes": (x) => `המורה '${x}' אמרה.`,
  "typographic quotes": (x) => `המורה “${x}” אמרה.`,
  "reversed typographic quotes": (x) => `המורה ”${x}“ אמרה.`,
  "Hebrew gershayim as quotes": (x) => `המורה ״${x}״ אמרה.`,
  "low-high quotes": (x) => `המורה „${x}” אמרה.`,
  guillemets: (x) => `המורה «${x}» אמרה.`,
  parentheses: (x) => `המורה (${x}) אמרה.`,
  brackets: (x) => `המורה [${x}] אמרה.`,
  commas: (x) => `המורה, ${x}, אמרה.`,
  "speaker colon": (x) => `${x}: אני מסכימה.`,
  "en dashes": (x) => `המורה – ${x} – אמרה.`,
  "maqaf join": (x) => `המורה־${x} אמרה.`,
  slash: (x) => `המורה/${x} אמרה.`,
  "no-break space inside": (x) => `המורה ${x.replace(" ", " ")} אמרה.`,
  "RLM around": (x) => `המורה ‏${x}‏ אמרה.`,
  "LRM inside": (x) => `המורה ${x.replace(" ", " ‎")} אמרה.`,
  "line break inside": (x) => `המורה ${x.replace(" ", "\n")} אמרה.`,
  "tab inside": (x) => `המורה ${x.replace(" ", "\t")} אמרה.`,
  "double space inside": (x) => `המורה ${x.replace(" ", "  ")} אמרה.`,
  ellipsis: (x) => `המורה…${x}… אמרה.`,
  "question mark": (x) => `האם ${x}? כן.`,
  bullet: (x) => `• ${x}`,
  numbered: (x) => `1. ${x} הגישה.`,
  asterisks: (x) => `המורה *${x}* אמרה.`,
  underscores: (x) => `המורה _${x}_ אמרה.`,
  "footnote digit after": (x) => `המורה ${x}2 אמרה.`,
  "footnote digit before": (x) => `המורה 2${x} אמרה.`,
};
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
