/* Release 3 engine rules, from the second real session (14.9 and 15.9).

   Short names: "לשי" survived four times because a two-letter name's prefixed
   forms only waited for review (Q3). Prefixed chips: "שארסן" got its own fake
   name beside "ארסן" (Q4). Dates: a deleted date made the AI say "the date is
   missing" (Q5). Places: "ירושלים" became a kibbutz from the untagged pool (Q7).
   And "שדוברת רוסית" was offered as a name. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
const hits = (text, subs, opt) => { const eng = new C.Engine(subs, [], opt || OPT, text); return eng.detect(text).map((h) => ({ t: h.text, apply: h.apply, rep: eng.repFor(h), type: h.type })); };
const DOPT = { ...OPT, on: new Set(["DATE"]) };

(async () => {
  console.log("\n— a confirmed short name covers its prefixed forms (Q3) —");
  {
    const text = "שי הגיע. אמרתי לשי שלום. הלכתי עם רן ושי. שרן אמר כן.";
    const out = hits(text, [{ value: "שי", kind: "NAME", replacement: "" }, { value: "רן", kind: "NAME", replacement: "" }]);
    const by = (t) => out.find((x) => x.t === t);
    ok(by("לשי") && by("לשי").apply, "לשי is replaced, not held for review");
    ok(by("ושי") && by("ושי").apply, "ושי is replaced");
    ok(by("שרן") && by("שרן").apply, "שרן is replaced");
    // the exception: a prefixed form that is a word of its own, found in the engine's own lists
    const isWord = (w) => C.COMMON.has(w) || C.WORDLIKE.has(w) || C.STOP.has(w) || C.VRB.has(w);
    let ex = null;
    for (const n of ["שם", "אור", "גל", "טל", "בר", "עד", "לב", "דן", "חן", "רם", "נר"]) for (const p of "בלמושהכ") if (!ex && isWord(p + n)) ex = [n, p + n];
    if (ex) {
      const o2 = hits(`${ex[0]} בא. ${ex[1]} היה שקט.`, [{ value: ex[0], kind: "NAME", replacement: "" }]);
      const h = o2.find((x) => x.t === ex[1]);
      ok(h && !h.apply, `${ex[1]} (a word on its own) still waits for review`);
    } else ok(true, "no short name with a listed prefixed word in the lists; exception not exercised");
  }

  console.log("\n— the prefix-letter merge signal (Q4 fallback) —");
  ok(C.mergeSignals("ארסן", "שארסן").includes("אות שימוש?"), "ארסן / שארסן");
  ok(C.mergeSignals("רון", "שרון").includes("אות שימוש?"), "רון / שרון: a suggestion she answers, never a fold");
  ok(C.mergeSignals("דנה כהן", "לדנה כהן").includes("אות שימוש?"), "two words with a prefix");

  console.log("\n— fold evidence from the model (Q4) —");
  {
    const TEXT = "ארסן חזר. שארסן נכנס. שרון: אני כאן. רון בא. שרון הלכה.";
    const mk = (value, cut) => ({ value, kind: "NAME", n: 1, cut: !!cut });
    const pipe = { tokenizer: { tokenize: (w) => (w === "שארסן" ? ["ש", "##ארסן"] : w === "שרון" ? ["שרון"] : [w]) } };
    const out = [mk("ארסן"), mk("שארסן"), mk("רון"), mk("שרון")];
    await C.foldEvidence(pipe, out, TEXT);
    const g = (v) => out.find((o) => o.value === v);
    ok(g("שארסן").prefixOf === "ארסן" && g("שארסן").fold === "yes", "שארסן folds: " + g("שארסן").foldWhy);
    ok(g("שרון").prefixOf === "רון" && g("שרון").fold === "no", "שרון never folds: " + g("שרון").foldWhy);
    // no tokenizer: unknown, never a fold
    const out2 = [mk("ארסן"), mk("שארסן")];
    await C.foldEvidence({}, out2, TEXT);
    ok(out2[1].fold === "unknown", "model off: unknown, so a suggestion, not a fold");
    // a cut span is prefix evidence; a speaker position blocks
    const out3 = [mk("ארסן"), mk("שארסן", true)];
    await C.foldEvidence({}, out3, TEXT);
    ok(out3[1].fold === "yes" && /cut/.test(out3[1].foldWhy), "a cut span folds: " + out3[1].foldWhy);
    const out4 = [mk("רון"), mk("שרון", true)];
    await C.foldEvidence({}, out4, TEXT);
    ok(out4[1].fold === "no" && /position|listed/.test(out4[1].foldWhy), "speaker position or the list blocks: " + out4[1].foldWhy);
    ok(C.namePosition("[14.9, 12:22] שרון: כן", "שרון"), "speaker after a timestamp");
    ok(C.namePosition("אמר ד\"ר שטרן כי", "שטרן"), "after a title");
    ok(!C.namePosition("הלכתי לשרון בבוקר", "שרון"), "mid-sentence is not a name position");
  }

  console.log("\n— shifted dates (Q5) —");
  ok(C.fakeDate("11.2.2026", 45) === "28.3.2026", "45 days on: " + C.fakeDate("11.2.2026", 45));
  ok(C.fakeDate("1/9/26", 100) === "10/12/26", "two-digit year and slash kept: " + C.fakeDate("1/9/26", 100));
  ok(C.fakeDate("31.12.2025", 1) === "1.1.2026", "year rolls over");
  ok(C.fakeDate("31.2.2026", 10) === null, "an impossible date is not shifted");
  {
    const text = "הדיון ב-11.2.2026 והפגישה ב-25.2.2026 ואחר כך 1.3.2026.";
    const out = hits(text, [], { ...DOPT, styles: { "*": "blank", DATE: "name" } }).filter((x) => x.type === "DATE");
    ok(out.length === 3 && out.every((x) => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(x.rep)), "every date is a date: " + out.map((x) => x.rep).join(" "));
    const day = (s) => { const [d, m, y] = s.split(".").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
    const d0 = out.map((x) => day(x.t)), d1 = out.map((x) => day(x.rep));
    ok(d1[1] - d1[0] === d0[1] - d0[0] && d1[2] - d1[1] === d0[2] - d0[1], "intervals are kept");
    const off = d1[0] - d0[0];
    ok(off >= 30 && off <= 400 && d1.every((d, i) => d - d0[i] === off), "one offset for the document, 30–400 days: " + off);
    const again = hits(text, [], { ...DOPT, styles: { "*": "blank", DATE: "name" } }).filter((x) => x.type === "DATE");
    ok(again[0].rep === out[0].rep, "the same document gives the same offset");
    // restore maps the shifted date back
    const r = C.restoreNames("הדיון היה ב-" + out[0].rep + ".", [[out[0].t, out[0].rep]]);
    ok(r.text.includes("ב-11.2.2026"), "restore brings the real date back: " + r.text);
    const blank = hits(text, [], { ...DOPT, styles: { "*": "blank" } }).filter((x) => x.type === "DATE");
    ok(blank.every((x) => x.rep === ""), "without the DATE style the old default (delete) still works");
  }

  console.log("\n— random place names respect the taxonomy (Q7) —");
  {
    const used = new Set(), forb = new Set();
    for (const [town, want] of [["ירושלים", "עיר"], ["מודיעין", "עיר"], ["נהלל", "מושב"]]) {
      const f = C.fakePlace(town, used, forb);
      const t = C.atlasTags(f);
      ok(t["סוג"] !== "לא ידוע", town + " → a tagged town: " + f);
      ok(t["אוכלוסייה"] === C.atlasTags(town)["אוכלוסייה"] && (want === "עיר" ? ["עיר", "מועצה מקומית"].includes(t["סוג"]) : t["סוג"] === want || t["סוג"] === "קיבוץ" || t["סוג"] === "יישוב קהילתי"), town + " keeps its character: " + f + " (" + t["סוג"] + ")");
    }
    const g = C.fakePlace("כפר לא קיים", new Set(), new Set());
    ok(g && C.atlasTags(g)["סוג"] !== "לא ידוע", "an unknown place still gets a tagged town, never the raw gazetteer: " + g);
    // a substitute that appears in the document with a prefix letter is rejected
    const f2 = C.fakePlace("ירושלים", new Set(), new Set(["לחיפה"]));
    ok(f2 !== "חיפה", "לחיפה in the document rules out חיפה: " + f2);
  }

  console.log("\n— anchors from the private transcripts: 'שמי X', and a possessive after a role —");
  {
    const an = (t) => C.anchored(t).map((a) => a.text + "/" + a.anchor);
    ok(an("טוב, נעים מאוד. אז שמי לודמילה.").includes("לודמילה/self"), "שמי X: " + an("טוב, נעים מאוד. אז שמי לודמילה."));
    ok(an("קוראים לי דנה, ואני מהמחלקה.").includes("דנה/self"), "קוראים לי X");
    ok(an("ואני הולכת הביתה.").length === 0, "ואני is not an anchor");
    ok(an("עובד סוציאלי שלו, ברנשטיין, אמר לו.").includes("ברנשטיין/carep"), "the possessive after the role is skipped: " + an("עובד סוציאלי שלו, ברנשטיין, אמר לו."));
    ok(!an("עובד סוציאלי שלו, ברנשטיין, אמר לו.").some((x) => /^שלו/.test(x)), "and 'שלו ברנשטיין' is not offered");
    ok(an("העובדת הסוציאלית שלה אמרה.").length === 0, "a possessive followed by a verb: nothing");
  }

  console.log("\n— a trailing geresh is part of the name (QA ISSUE-002) —");
  ok(C.trimEdges("יואב ברקוביץ׳") === "יואב ברקוביץ׳", "ברקוביץ׳ keeps its geresh");
  ok(C.trimEdges("יואב ברקוביץ׳.") === "יואב ברקוביץ׳", "punctuation after the geresh is removed, the geresh stays");
  ok(C.trimEdges("ג׳ורג׳ אבוטבול,") === "ג׳ורג׳ אבוטבול", "geresh inside a word is untouched");
  ok(C.trimEdges("\"רונית לוי\"") === "רונית לוי" && C.trimEdges("(דנה כהן)") === "דנה כהן", "wrapping quotes and brackets still go");
  ok(C.trimEdges("רונית לוי'") === "רונית לוי'", "a plain apostrophe after a Hebrew letter is kept too (ברקוביץ')");
  ok(C.trimEdges("שלום ׳") === "שלום", "a geresh after a space is punctuation");

  console.log("\n— a prefixed adjective is not a name —");
  {
    const TEXT = "היא שדוברת רוסית. דנה כהן באה.";
    const E = (s, type) => ({ s: TEXT.indexOf(s), e: TEXT.indexOf(s) + s.length, type, score: 0.95 });
    const out = C.nerClean([E("שדוברת רוסית", "PER"), E("דנה כהן", "PER")], TEXT).map((x) => x.value);
    ok(!out.includes("שדוברת רוסית") && !out.includes("דוברת רוסית"), "שדוברת רוסית dropped: " + out.join(", "));
    ok(out.includes("דנה כהן"), "a real name stays");
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
