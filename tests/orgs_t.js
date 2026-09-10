/* Organisations by head-word rules, not by a closed list.

   On the real session "חסידות ברסלב" was offered as an organisation to fake,
   and "ברסלב" alone turned into a person's name. Her rule, in her words: a
   broad group (a Hasidic court, a movement, a party, a stream, a community)
   is not an identifier and is never offered; an institution with a type
   word (עמותת, מעון, בית ספר, מרפאת…) is offered and the fake keeps the type
   word; a name with neither head goes to review and never enters the list
   by itself. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— head words —");
for (const v of ["חסידות ברסלב", "חסידי גור", "תנועת הנוער", "מפלגת העבודה", "עדת הבוכרים", "קהילת יוצאי צרפת"])
  ok(C.GROUP_HEADS.test(C.norm(v)), "group, never offered: " + v);
for (const [v, head] of [["עמותת שביל הלב", "עמותת"], ["מעון נעמת", "מעון"], ["בית ספר אורט", "בית ספר"], ["מרפאת טיפת חלב", "מרפאת"], ["קופת חולים מכבי", "קופת חולים"], ['ביה"ס רמות', 'ביה"ס']])
  ok(C.orgHead(v) === head, "institution head of " + v + ": " + C.orgHead(v));
for (const v of ["ברסלב", "שביל הלב", "פנים מאירות"])
  ok(C.orgHead(v) === null && !C.GROUP_HEADS.test(v), "no head, review: " + v);

console.log("\n— fake keeps the type word, and is stable —");
{
  const a = C.fakeOrg("עמותת שביל הלב", new Set(), new Set());
  ok(/^עמותת \S+$/.test(a) && !/שביל|הלב/.test(a), "עמותת שביל הלב → " + a);
  ok(a === C.fakeOrg("עמותת שביל הלב", new Set(), new Set()), "same input, same fake");
  ok(a !== C.fakeOrg("עמותת אור החיים", new Set(), new Set()), "different input, different fake");
  const b = C.fakeOrg("בית ספר אורט", new Set(), new Set());
  ok(/^בית ספר \S+$/.test(b) && !/אורט/.test(b), "two-word head kept: " + b);
  // a fake already used goes to the next one
  const used = new Set([a]);
  const a2 = C.fakeOrg("עמותת שביל הלב", used, new Set());
  ok(a2 !== a && /^עמותת /.test(a2), "used fake is skipped: " + a2);
  // a tail that is a word of the document is forbidden
  const forb = new Set([C.norm(a.split(" ")[1])]);
  const a3 = C.fakeOrg("עמותת שביל הלב", new Set(), forb);
  ok(a3 !== a && /^עמותת /.test(a3), "forbidden tail is skipped: " + a3);
  // no head: a name is still produced, without inventing a type word
  const c = C.fakeOrg("פנים מאירות", new Set(), new Set());
  ok(c && !/\s/.test(c), "headless org gets a plain fake: " + c);
}

console.log("\n— the model's ORG candidates: group dropped, headless flagged —");
{
  const TEXT = "האם שייכת לחסידות ברסלב. הילד לומד בבית ספר אורט. עמותת שביל הלב ליוותה. ברסלב מנהלת את המקום. משרד הרווחה השיב.";
  const E = (surface, type, score) => ({ s: TEXT.indexOf(surface), e: TEXT.indexOf(surface) + surface.length, type, score });
  const out = C.nerClean([
    E("חסידות ברסלב", "ORG", 0.99), E("בית ספר אורט", "ORG", 0.98),
    E("עמותת שביל הלב", "ORG", 0.99), E("ברסלב", "ORG", 0.9), E("משרד הרווחה", "ORG", 0.99),
  ], TEXT);
  const val = s => out.find(x => x.value === s);
  ok(!val("חסידות ברסלב"), "group is dropped   (got: " + out.map(x => x.value).join(", ") + ")");
  ok(val("בית ספר אורט") && !val("בית ספר אורט").review, "institution offered as usual");
  ok(val("עמותת שביל הלב") && !val("עמותת שביל הלב").review, "עמותת offered as usual");
  ok(val("ברסלב") && val("ברסלב").review === true, "headless name flagged for review");
  ok(!val("משרד הרווחה"), "public body still never offered");
  // "המוסד לביטוח לאומי": the head-word peel took the ה off and turned a public
  // body into a private-looking "מוסד לביטוח לאומי" (three new false positives on the bench)
  const T2 = "התובעת פנתה למוסד לביטוח לאומי. המוסד לביטוח לאומי השיב.";
  const E2 = (surface, type, score) => ({ s: T2.lastIndexOf(surface), e: T2.lastIndexOf(surface) + surface.length, type, score });
  const out2 = C.nerClean([E2("המוסד לביטוח לאומי", "ORG", 0.99)], T2);
  ok(out2.length === 0, "a public body is not offered after the head-word peel: " + out2.map((x) => x.value).join(", "));
}

console.log("\n— end to end: the replacement keeps the head —");
{
  const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
  const text = "הילד שהה במעון של עמותת שביל הלב. לעמותת שביל הלב יש סניף.";
  const eng = new C.Engine([{ value: "עמותת שביל הלב", kind: "ORG", replacement: "" }], [], OPT, text);
  const hits = eng.detect(text);
  ok(hits.length === 2, "both occurrences hit: " + hits.length);
  const reps = hits.map(h => eng.repFor(h));
  ok(reps.every(r => /^ל?עמותת \S+$/.test(r) && !/שביל/.test(r)), "fake keeps עמותת: " + reps.join(" | "));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
