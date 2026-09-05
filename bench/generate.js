/* Builds the benchmark corpus and its answer key in one pass.

   Every document is composed from entity objects, and the key is written
   from those same objects, so the key cannot drift from the text. After
   composing, the generator asserts that every surface form it recorded
   actually occurs in the document, that every category appears in at
   least three documents, and that no corpus name is known to the tool.

   The honesty rule. Names come from a hand-picked list that was probed
   against every lexicon the detector carries: FEM, MASC, WORDLIKE, the
   fake-name POOL, and KNOWN_FIRST which unions them; places against
   PLACE_BY as whole strings. If the corpus and the detector shared a
   lexicon, a hit would measure a tautology. One category is exempt by
   design, "names that are also common words": those six names are
   mandated, they are in the tool's word lists precisely because they are
   words, and the report marks their hits as lexicon-aided. */
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");
const { mkzip } = require("../tests/mkzip.js");

const OUT = path.join(__dirname, "corpus");
fs.mkdirSync(OUT, { recursive: true });

// ── categories ──────────────────────────────────────────────────────────────
const C = {
  P_WORD: "person: name that is also a common word",
  P_PROSE: "person: only in prose, never before a speech verb",
  P_PREFIX_ONCE: "person: once, only with a prefix letter",
  P_CORRUPT_ONLY: "person: only in corrupted form, never cleanly",
  P_TWO_SPELL: "person: same person, one clean and one corrupted spelling",
  P_FORMS: "person: full name, surname alone, first name alone",
  P_SHARED_SURNAME: "person: two people sharing a surname",
  P_ED1_PAIR: "person: two people edit-distance 1 apart (must not merge)",
  P_ARABIC: "person: Arabic name",
  P_ETHIOPIAN: "person: Ethiopian name",
  P_RUSSIAN: "person: Russian name",
  P_MINOR: "person: minor, first name only",
  P_TITLE: "person: title attached",
  P_ROLE_NOCOLON: "person: role word directly before, no colon",
  P_NIKUD: "person: nikud on one occurrence",
  P_HYPHEN: "person: hyphenated surname, elsewhere with a space",
  P_SPLITRUN: "person: name split across two runs mid-word",
  P_LOOKS_ORG: "person: name that reads like a body's",
  O_PRIVATE: "org: private body, must be redacted",
  O_PUBLIC: "org: public body, must not be redacted",
  O_LOOKS_PERSON: "org: body whose name reads like a person's",
  L_TOWN: "place: town",
  L_NEIGHBOURHOOD: "place: neighbourhood",
  L_STREET: "place: street",
  T_PLONI: "trap: פלוני / פלונית",
  T_NUMBERS: "trap: case numbers, dates, section references",
  T_IDIOM: "trap: idiom or public title beside a same-word name",
};
const EXEMPT_FROM_DISJOINT = new Set(["P_WORD", "T_IDIOM"]);
const EXPECTED_FAIL = new Set(["P_PREFIX_ONCE", "P_CORRUPT_ONLY"]);

// ── document builder ────────────────────────────────────────────────────────
class Doc {
  constructor(id, genre, title) { this.id = id; this.genre = genre; this.title = title; this.paras = []; this.ents = []; }
  // kind NAME|ORG|PLACE|TRAP; must = should be redacted; surfaces = every string
  // form that appears in this document. Returns the surfaces for embedding.
  ent(cat, kind, must, canonical, surfaces, note) {
    this.ents.push({ cat, kind, must, canonical, surfaces: [...new Set(surfaces)], note: note || "" });
    return surfaces;
  }
  p(...runs) { this.paras.push(runs.length === 1 ? runs[0] : runs); return this; }
  text() { return this.paras.map((p) => (Array.isArray(p) ? p.join("") : p)).join("\n"); }
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function docx(doc) {
  const body = doc.paras.map((p) => {
    const runs = Array.isArray(p) ? p : [p];
    return "<w:p>" + runs.map((r) => '<w:r><w:t xml:space="preserve">' + esc(r) + "</w:t></w:r>").join("") + "</w:p>";
  }).join("");
  return mkzip([
    { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>' },
    { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="x" Target="word/document.xml"/></Relationships>' },
    { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ' + W + "><w:body>" + body + "</w:body></w:document>" },
  ]);
}
const last = (s) => s.replace(/^(עו"ד|ד"ר|גב'|משפחת|המבקשת|הנתבע|התובעת) /, "").split(" ").slice(-1)[0];
const first = (s) => s.replace(/^(עו"ד|ד"ר|גב'|משפחת|המבקשת|הנתבע|התובעת) /, "").split(" ")[0];

// ── the corpus ──────────────────────────────────────────────────────────────
const docs = [];
const NIK_MIKA = "מִיקָה"; // nikud on one occurrence of מיקה
const PUBLIC = ["בית המשפט לענייני משפחה", "משרד הרווחה", "המוסד לביטוח לאומי"];

// meeting summary 1 ─ short
{
  const d = new Doc("m1", "meeting", "סיכום פגישה");
  const [a1, a2] = d.ent("P_ARABIC", "NAME", true, "סאמר קעדאן", ["סאמר קעדאן", "קעדאן"]);
  const [w1] = d.ent("P_WORD", "NAME", true, "חיים סבג", ["חיים סבג", "חיים"], "lexicon-aided by design");
  const [t1] = d.ent("P_TITLE", "NAME", true, "יערה ליפשיץ", ['עו"ד יערה ליפשיץ', "ליפשיץ"]);
  const [ts1, ts2] = d.ent("P_TWO_SPELL", "NAME", true, "דסטה טספאיי", ["דסטה טספאיי", "תספאיי"], "second form swaps ט for ת");
  d.ent("P_SPLITRUN", "NAME", true, "עמיחי אלמגור", ["עמיחי אלמגור"], "split mid-word across two runs");
  const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "עמותת שביל הלב", ["עמותת שביל הלב", "שביל הלב"]);
  const [l1] = d.ent("L_TOWN", "PLACE", true, "נוף הגליל", ["נוף הגליל"]);
  d.ent("T_NUMBERS", "TRAP", false, "14.5.2026", ["14.5.2026", "סעיף 3(א)"]);
  d.ent("T_IDIOM", "TRAP", false, "בחיים לא ראיתי", ["בחיים לא ראיתי"]);
  d.p("סיכום פגישה מיום 14.5.2026")
   .p(`נפגשתי היום עם ${a1} במשרד. ${a2} הגיע עם אחותו ובלי הילדים. הוא סיפר ש${w1} לא העביר מזונות כבר שלושה חודשים, ושהמצב בבית קשה.`)
   .p(`בחיים לא ראיתי תיק כזה. ${first(w1)} מסרב לשתף פעולה, ולפי סעיף 3(א) להסכם עליו להודיע מראש על כל שינוי.`)
   .p(`שוחחתי בטלפון עם ${t1} ממשרד ${o1}, והיא אישרה שהמשפחה מוכרת ל${o1b} מאז 2024. ${ts1} מ${o1b} דיווח על ירידה בתפקוד.`)
   .p("עמי", `חי אלמגור, המדריך בקבוצה, סיפר ש${ts2} מתקשה להגיע לפגישות. לדבריו ליפשיץ תעדכן בכתב.`)
   .p(`המשפחה גרה ב${l1}, והאב עבר לאחרונה לדירה שכורה. סיכמנו שאפנה ללשכה בעניין הקצבה.`);
  docs.push(d);
}
// meeting summary 2
{
  const d = new Doc("m2", "meeting", "סיכום פגישה");
  const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "אריאל הורוביץ", ["אריאל הורוביץ", "הורוביץ", "אריאל"]);
  const [pr] = d.ent("P_PROSE", "NAME", true, "ענבר", ["ענבר"], "never before a speech verb");
  const [et1] = d.ent("P_ETHIOPIAN", "NAME", true, "מולו טגניה", ["מולו טגניה", "טגניה"]);
  const [rn] = d.ent("P_ROLE_NOCOLON", "NAME", true, "סיון נבון", ["התובעת סיון נבון", "נבון"]);
  const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "מעון גן הדובים", ["מעון גן הדובים", "גן הדובים"]);
  const [lp1, lp2] = d.ent("O_LOOKS_PERSON", "ORG", true, "שילה ואופק", ["מעון שילה ואופק", "שילה ואופק"], "a daycare named like two children");
  const [nb, nb2] = d.ent("L_NEIGHBOURHOOD", "PLACE", true, "שכונת נווה רם", ["שכונת נווה רם", "נווה רם"]);
  d.p("סיכום פגישה — משפחת הורוביץ")
   .p(`נפגשתי עם ${f1} ועם ${rn}. ${f2} הגיע באיחור. במקרה של ${pr} סיכמנו שהמעבר יהיה הדרגתי, ובשביל ${pr} חשוב שהמסגרת תישאר יציבה.`)
   .p(`אמא של ${pr} מודאגת בעיקר מהנושא של המעון. ${f3} מבקש שהילדה תישאר ב${o1}, ואילו ${last(rn)} מעדיפה את ${lp1}. המורה ${et1} דיווחה שהילדה מתפקדת היטב.`)
   .p(`${lp2} נמצא ב${nb}, קרוב לבית של ${f2}. ${last(et1)} תכין חוות דעת עד סוף החודש. ${o1b} מסרב לקבל ילדים חדשים השנה. ${nb2} שקטה בלילה.`)
   .p(`סיכמנו שאפנה למחלקה בעניין ההסעות, ואגיש בקשה לצו הגנה אם יידרש. ${f2} יעדכן.`);
  docs.push(d);
}
// meeting summary 3
{
  const d = new Doc("m3", "meeting", "סיכום פגישה");
  const [s1, s1b] = d.ent("P_SHARED_SURNAME", "NAME", true, "מורן רוזנטל", ["מורן רוזנטל", "מורן"]);
  const [s2, s2b] = d.ent("P_SHARED_SURNAME", "NAME", true, "נמרוד רוזנטל", ["נמרוד רוזנטל", "רוזנטל"], "shares a surname with מורן");
  const [ru1] = d.ent("P_RUSSIAN", "NAME", true, "איגור וולקוב", ["איגור וולקוב", "וולקוב"]);
  const [nk1, nk2] = d.ent("P_NIKUD", "NAME", true, "מיקה", ["מיקה", NIK_MIKA], "one occurrence carries nikud");
  d.ent("P_PREFIX_ONCE", "NAME", true, "הילי", ["בהילי"], "expected to fail: single mention, prefix letter only");
  const [lo] = d.ent("P_LOOKS_ORG", "NAME", true, "עומרי גן", ["עומרי גן"], "surname is an org prefix word");
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[1], [PUBLIC[1]]);
  d.p("סיכום פגישה — הסדרי שהות")
   .p(`${s1} ו${s2} הגיעו יחד. ${s1b} סיפרה שהילדים, ${nk1} ו${first(lo)}, מתקשים במעברים. ${nk2} בת חמש, ומסרבת ללכת לגן בימי ראשון.`)
   .p(`הפסיכולוג ${ru1} ממליץ על הסדרי שהות מצומצמים. ${last(ru1)} ציין שפגש בהילי פעם אחת בלבד. ${s2b} טוען שההמלצה מוטה.`)
   .p(`${lo}, אביו של האב, מוכן לסייע כלכלית. הפניה ל${PUBLIC[1]} נעשתה בשבוע שעבר, ו${nk1} תתחיל טיפול רגשי בחודש הבא.`)
   .p(`סיכמנו שאעביר את חוות הדעת של ${last(ru1)} לצד השני, ושהפגישה הבאה תתקיים בנוכחות ${s1b} בלבד.`);
  docs.push(d);
}
// meeting summary 4 ─ longer
{
  const d = new Doc("m4", "meeting", "סיכום פגישה");
  const [e1, e1b] = d.ent("P_ED1_PAIR", "NAME", true, "מורן אביטן", ["מורן אביטן", "אביטן"]);
  const [e2, e2b] = d.ent("P_ED1_PAIR", "NAME", true, "ינון אביתן", ["ינון אביתן", "אביתן"], "one letter from אביטן; a different person");
  const [co, cob] = d.ent("P_CORRUPT_ONLY", "NAME", true, "טיטו וורקו", ["טיטו ווארקו", "ווארקו"], "expected to fail: only the corrupted form appears");
  const [hy1, hy2] = d.ent("P_HYPHEN", "NAME", true, "אלה בן-רביב", ["אלה בן-רביב", "בן רביב"]);
  const [mn] = d.ent("P_MINOR", "NAME", true, "אופק", ["אופק"], "minor, first name only");
  const [st, stb] = d.ent("L_STREET", "PLACE", true, "רחוב הארזים 12", ["רחוב הארזים 12", "הארזים"]);
  d.p("סיכום פגישה — משפחת אביטן")
   .p(`${e1} הגיעה לפגישה עם ${hy1}, העובדת הסוציאלית של המשפחה. ${e2}, שכנה מהבניין, הצטרפה בהמשך. חשוב להבחין: ${e1b} ו${e2b} הם שני אנשים שונים.`)
   .p(`${co} סיפר שהוא רואה את ${mn} כמעט כל יום, ושהילד חוזר מבית הספר לבד. ${cob} גר ב${st}, שתי קומות מעל המשפחה.`)
   .p(`${hy2} ממליצה על ליווי של מדריך נוער. ${mn} בן שבע, ולדבריו הוא אוהב את בית הספר אבל לא את ההסעה.`)
   .p(`${e2b} התלוננה על רעש, ואילו ${e1b} טוענת שמדובר בהטרדה. ${hy2} תבדוק עם המשטרה הקהילתית.`)
   .p(`סיכמנו: הפניה למדריך, בדיקה של ההסעות מ${stb}, ופגישה נוספת בעוד חודש. ${first(co)} ביקש להיות מעודכן.`);
  docs.push(d);
}
// filing 1
{
  const d = new Doc("f1", "filing", "כתב תביעה");
  const [rn1, rn1b] = d.ent("P_ROLE_NOCOLON", "NAME", true, "סיון נבון", ["התובעת סיון נבון", "נבון"]);
  const [rn2, rn2b] = d.ent("P_ROLE_NOCOLON", "NAME", true, "צור אסולין", ["הנתבע צור אסולין", "אסולין"]);
  const [t1, t1b] = d.ent("P_TITLE", "NAME", true, "יערה ליפשיץ", ['עו"ד יערה ליפשיץ', "ליפשיץ"]);
  const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "אריאל הורוביץ", ["אריאל הורוביץ", "הורוביץ", "אריאל"]);
  const [ts1, ts2] = d.ent("P_TWO_SPELL", "NAME", true, "נתנאל וייסמן", ["נתנאל וייסמן", "ויסמן"], "second form drops a yod");
  const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "נטליה פטרובה", ["נטליה פטרובה", "פטרובה"]);
  const [o1] = d.ent("O_PRIVATE", "ORG", true, "בית ספר ניצני הגליל", ["בית ספר ניצני הגליל"]);
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[0], [PUBLIC[0]]);
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[2], [PUBLIC[2]]);
  const [l1] = d.ent("L_TOWN", "PLACE", true, "בית זית", ["בית זית"]);
  const [st] = d.ent("L_STREET", "PLACE", true, "רחוב התאנה 4", ["רחוב התאנה 4"]);
  d.ent("T_PLONI", "TRAP", false, "פלונית", ["פלונית", "פלוני"]);
  d.ent("T_NUMBERS", "TRAP", false, 'תלה"מ 12345-06-24', ['תלה"מ 12345-06-24', "3.6.2026", "סעיף 7(ב)"]);
  d.p(`ב${PUBLIC[0]} בירושלים`)
   .p('תלה"מ 12345-06-24')
   .p(`${rn1}, מ${st}, ${l1}`)
   .p(`${rn2}, באמצעות ב"כ ${t1}`)
   .p(`1. התובעת והנתבע נישאו ביום 3.6.2026 ולהם שני ילדים. ${f1}, אחיה של התובעת, נכח בדיון הקודם.`)
   .p(`2. ${ts1}, המומחה מטעם בית המשפט, קבע כי הילדים לומדים ב${o1}. ${ts2} המליץ על מסגרת טיפולית.`)
   .p(`3. הפסיכולוגית ${ru1} ציינה כי ${f2} מהווה דמות תומכת. ${f3} הצהיר כי יסייע ככל שיידרש.`)
   .p(`4. ${rn2b} לא העביר מזונות, בניגוד לסעיף 7(ב) להסכם. ${ru1b} תמכה בעמדת התובעת.`)
   .p(`5. פלונית, שכנה, מסרה תצהיר. פלוני נוסף סירב להעיד. ${PUBLIC[2]} אישר קצבה.`)
   .p(`6. ב"כ התובעת ${t1b} מבקשת מבית המשפט הנכבד לקבל את התביעה. ${rn1b} תישא בהוצאות ככל שתידחה.`);
  docs.push(d);
}
// filing 2
{
  const d = new Doc("f2", "filing", "בקשה לצו הגנה");
  const [w1] = d.ent("P_WORD", "NAME", true, "גיל נבון", ["גיל נבון"], "lexicon-aided by design");
  const [w2, w2b] = d.ent("P_WORD", "NAME", true, "שחר גולן", ["שחר גולן", "שחר"], "lexicon-aided by design");
  const [s1] = d.ent("P_SHARED_SURNAME", "NAME", true, "מורן רוזנטל", ["מורן רוזנטל"]);
  const [s2, s2b] = d.ent("P_SHARED_SURNAME", "NAME", true, "נמרוד רוזנטל", ["נמרוד רוזנטל", "רוזנטל"], "shares a surname with מורן");
  const [t1, t1b] = d.ent("P_TITLE", "NAME", true, "נתנאל גולן", ['ד"ר נתנאל גולן', "גולן"]);
  const [t2, t2b] = d.ent("P_TITLE", "NAME", true, "רויטל סבג", ["גב' רויטל סבג", "סבג"]);
  const [et1, et1b] = d.ent("P_ETHIOPIAN", "NAME", true, "אברה ברהנו", ["אברה ברהנו", "ברהנו"]);
  const [hy1, hy2] = d.ent("P_HYPHEN", "NAME", true, "אלה בן-רביב", ["אלה בן-רביב", "בן רביב"]);
  const [lo] = d.ent("P_LOOKS_ORG", "NAME", true, "עומרי גן", ["עומרי גן"], "surname is an org prefix word");
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[0], [PUBLIC[0]]);
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[1], [PUBLIC[1]]);
  const [nb] = d.ent("L_NEIGHBOURHOOD", "PLACE", true, "שכונת גני אביב", ["שכונת גני אביב"]);
  d.ent("T_PLONI", "TRAP", false, "פלוני", ["פלוני"]);
  d.ent("T_NUMBERS", "TRAP", false, "סעיף 2", ["סעיף 2", "18.7.2026", 'ת"פ 4471-02-26']);
  d.ent("T_IDIOM", "TRAP", false, "בגיל 8", ["בגיל 8", "עם שחר"], "בגיל 8 beside גיל; עם שחר beside שחר");
  d.p(`בקשה לצו הגנה — ${PUBLIC[0]}`)
   .p(`המבקשת: ${s1}. המשיב: ${s2}. ת"פ 4471-02-26.`)
   .p(`1. המבקשת ו${s2b} נשואים משנת 2014. ביום 18.7.2026 עם שחר הגיע המשיב לדירה ב${nb} ואיים עליה. ${w2} השכן שמע את הצעקות.`)
   .p(`2. ${t1} בדק את המבקשת ומצא סימני חבלה. ${t1b} המליץ על מעקב. גם ${w1} מסר תצהיר תומך.`)
   .p(`3. הבן בגיל 8 היה בבית באותו ערב. ${t2} מ${PUBLIC[1]} דיווחה כי המבקשת פנתה ללשכה בעבר. ${et1} מהמרכז הקהילתי מכיר את המשפחה.`)
   .p(`4. ${hy1} הגישה חוות דעת. ${hy2} קבעה כי יש סיכון ממשי. ${lo}, שכן נוסף, אישר בכתב. פלוני שלישי סירב לחתום.`)
   .p(`5. לפי סעיף 2 לחוק, מתבקש בית המשפט ליתן צו האוסר על ${s2b} להתקרב. ${et1b} ו${t2b} יזומנו לעדות, וכך גם ${w2b}.`);
  docs.push(d);
}
// filing 3
{
  const d = new Doc("f3", "filing", "תסקיר");
  const [e1, e1b] = d.ent("P_ED1_PAIR", "NAME", true, "מורן אביטן", ["מורן אביטן", "אביטן"]);
  const [e2, e2b] = d.ent("P_ED1_PAIR", "NAME", true, "ינון אביתן", ["ינון אביתן", "אביתן"], "one letter from אביטן; a different person");
  const [rn, rnb] = d.ent("P_ROLE_NOCOLON", "NAME", true, "אלה בן-רביב", ["המבקשת אלה בן-רביב", "בן-רביב"]);
  const [t1, t1b] = d.ent("P_TITLE", "NAME", true, "משפחת בוזגלו", ["משפחת בוזגלו", "בוזגלו"]);
  const [mn] = d.ent("P_MINOR", "NAME", true, "עומרי", ["עומרי"], "minor, first name only");
  d.ent("P_PREFIX_ONCE", "NAME", true, "רויטל", ["לרויטל"], "expected to fail: single mention, prefix letter only");
  const [sr] = d.ent("P_SPLITRUN", "NAME", true, "ויקטור סמירנוב", ["ויקטור סמירנוב"], "split mid-word across two runs");
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[1], [PUBLIC[1]]);
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[2], [PUBLIC[2]]);
  const [l1] = d.ent("L_TOWN", "PLACE", true, "מבוא חורון", ["מבוא חורון"]);
  d.ent("T_NUMBERS", "TRAP", false, "סעיף 14", ["סעיף 14", "22.1.2026"]);
  d.p(`תסקיר ${PUBLIC[1]} — לשכת הרווחה`)
   .p(`${rn} הגישה בקשה להסדרי שהות. ${e1}, האם, מתגוררת ב${l1} עם ${mn}. ${e2}, אחיה של האם, מתגורר בסמוך.`)
   .p(`${e1b} ו${e2b} הם שני אנשים שונים, ויש להיזהר בניסוח. ${t1} השכנים מסרו כי ${mn} משחק אצלם אחר הצהריים.`)
   .p("ויקט", `ור סמירנוב, האב, נפגש עם ${mn} פעם בשבועיים. ${last(sr)} ביקש להרחיב את ההסדר. הפנייה לרויטל נעשתה ביום 22.1.2026.`)
   .p(`לפי סעיף 14 לחוק, ${PUBLIC[2]} משלם קצבת ילדים לאם. ${t1b} דיווחו על מריבות קולניות. ${rnb} תעדכן את הלשכה.`)
   .p(`המלצה: הרחבה הדרגתית של ההסדר עם ${first(sr)}, בליווי ${e2b}. ${mn} בן שש וחצי.`);
  docs.push(d);
}
// filing 4 ─ longer
{
  const d = new Doc("f4", "filing", "תצהיר");
  const [a1, a1b] = d.ent("P_ARABIC", "NAME", true, "לינא מסאלחה", ["לינא מסאלחה", "מסאלחה"]);
  const [a2, a2b] = d.ent("P_ARABIC", "NAME", true, "ואיל שקור", ["ואיל שקור", "שקור"]);
  const [a3] = d.ent("P_ARABIC", "NAME", true, "עבד אל-האדי", ["עבד אל-האדי"]);
  const [t1, t1b] = d.ent("P_TITLE", "NAME", true, "רויטל סבג", ["גב' רויטל סבג", "סבג"]);
  const [co, cob] = d.ent("P_CORRUPT_ONLY", "NAME", true, "יערה שפרינצק", ["יערה שפרינסק", "שפרינסק"], "expected to fail: only the corrupted form appears");
  const [nk1, nk2] = d.ent("P_NIKUD", "NAME", true, "מיקה", ["מיקה", NIK_MIKA], "one occurrence carries nikud");
  const [lp] = d.ent("O_LOOKS_PERSON", "ORG", true, "שילה ואופק", ["שילה ואופק"], "a daycare named like two children");
  const [st, stb] = d.ent("L_STREET", "PLACE", true, "שדרות הנשיאים 8", ["שדרות הנשיאים 8", "הנשיאים"]);
  d.ent("T_NUMBERS", "TRAP", false, "סעיף 5", ["סעיף 5", "9.9.2025", "ת/7"]);
  d.p("תצהיר")
   .p(`אני הח"מ ${a1}, לאחר שהוזהרתי כי עליי לומר את האמת, מצהירה בזאת כדלקמן:`)
   .p(`1. אני מתגוררת ב${st} מאז 9.9.2025. ${a2}, בעלי לשעבר, עזב את הדירה. ${a3} הוא אביו.`)
   .p(`2. ${t1} מהלשכה ביקרה אצלנו. ${t1b} כתבה שהילדה, ${nk1}, מתפקדת היטב. ${nk2} בת ארבע ולומדת ב${lp}.`)
   .p(`3. ${co} טיפלה בבתי במסגרת פרטית. ${cob} המליצה על המשך טיפול. ${a2b} סירב לשלם.`)
   .p(`4. לפי סעיף 5 להסכם, ${a3} התחייב לסייע. מצורף כנספח ת/7 מכתבו. אני, ${a1b}, מבקשת לקבוע מזונות זמניים.`)
   .p(`5. ${a2} טוען כי ${nk1} אינה בתו. אני מצהירה כי הדבר שקר. ${stb} היא כתובתי הקבועה.`)
   .p("זה שמי, זו חתימתי, ותוכן תצהירי אמת.");
  docs.push(d);
}
// transcript 1
{
  const d = new Doc("t1", "transcript", "תמלול דיון");
  const [w1, w1b] = d.ent("P_WORD", "NAME", true, "דור רביב", ["דור רביב", "דור"], "lexicon-aided by design");
  const [w2, w2b] = d.ent("P_WORD", "NAME", true, "אלישע שר", ["אלישע שר", "מר שר"], "lexicon-aided by design; beside שר הרווחה");
  const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "אריאל הורוביץ", ["אריאל הורוביץ", "הורוביץ", "אריאל"]);
  const [pr] = d.ent("P_PROSE", "NAME", true, "ענבר", ["ענבר"], "never before a speech verb");
  const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "אנסטסיה קוזלוב", ["אנסטסיה קוזלוב", "קוזלוב"]);
  const [rn, rnb] = d.ent("P_ROLE_NOCOLON", "NAME", true, "צור אסולין", ["הנתבע צור אסולין", "אסולין"]);
  d.ent("O_PUBLIC", "ORG", false, PUBLIC[1], [PUBLIC[1]]);
  const [l1] = d.ent("L_TOWN", "PLACE", true, "אלון שבות", ["אלון שבות"]);
  d.ent("T_PLONI", "TRAP", false, "פלוני", ["פלוני"]);
  d.ent("T_IDIOM", "TRAP", false, "שר הרווחה", ["שר הרווחה", "דור שלישי"], "שר הרווחה beside שר; דור שלישי beside דור");
  d.p("תמלול דיון — פרוטוקול")
   .p(`השופטת: אנחנו בדיון בעניין ${f1}. ${rn} נוכח. מי מייצג?`)
   .p(`${w1}: אני. ${f2} הוא הלקוח שלי. אני רוצה להתייחס למה שאמר פלוני בדיון הקודם.`)
   .p(`השופטת: ${w2b}, אתה מבקש להגיב?`)
   .p(`${w2}: כן. ${PUBLIC[1]} ושר הרווחה עצמו הבטיחו תקציב. במקרה של ${pr} זה לא הגיע. ${f3} ביקש הבהרה בכתב.`)
   .p(`${ru1}: אני העובדת הסוציאלית. אמא של ${pr} פנתה אליי, ובשביל ${pr} פתחנו תיק. ${w1b} יודע את זה.`)
   .p(`${w1}: ${ru1b}, המשפחה עברה ל${l1} לפני שנה. זו משפחה מדור שלישי בעיר, ו${rnb} לא ביקר שם אף פעם.`)
   .p(`השופטת: ${f2} יגיש תצהיר. ${w1b}, תעדכן את ${ru1b}. הדיון נדחה.`);
  docs.push(d);
}
// transcript 2
{
  const d = new Doc("t2", "transcript", "תמלול שיחה");
  const [a1, a1b] = d.ent("P_ARABIC", "NAME", true, "סאמר קעדאן", ["סאמר קעדאן", "קעדאן"]);
  const [a2] = d.ent("P_ARABIC", "NAME", true, "אבו ריא", ["אבו ריא"]);
  const [ts1, ts2] = d.ent("P_TWO_SPELL", "NAME", true, "דסטה טספאיי", ["דסטה טספאיי", "תספאיי"], "second form swaps ט for ת");
  const [hy1, hy2] = d.ent("P_HYPHEN", "NAME", true, "אלה בן-רביב", ["אלה בן-רביב", "בן רביב"]);
  const [mn] = d.ent("P_MINOR", "NAME", true, "אופק", ["אופק"], "minor, first name only");
  d.ent("P_PREFIX_ONCE", "NAME", true, "נהוראי", ["ונהוראי"], "expected to fail: single mention, prefix letter only");
  const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "מרפאת עין הכרמים", ["מרפאת עין הכרמים", "עין הכרמים"]);
  const [l1] = d.ent("L_TOWN", "PLACE", true, "גני יוחנן", ["גני יוחנן"]);
  d.p("תמלול שיחה מוקלטת")
   .p(`${a1}: אני מדבר מ${l1}. ${a2} נמצא איתי. אנחנו רוצים לדבר על ${mn}.`)
   .p(`${hy1}: ${mn} בן שבע. הוא מטופל ב${o1} כבר חצי שנה. ${ts1} הוא המטפל שלו.`)
   .p(`${a1b}: ${ts2} אמר לי שיש שיפור. ${a2} לא מסכים. הוא חושב ש${hy2} לא רואה את התמונה המלאה.`)
   .p(`${hy1}: אני רואה את ${mn} כל שבוע. ${o1b} שולחת דוחות. אתמול היו שם גם אחיו ונהוראי, חבר מהכיתה.`)
   .p(`${a1}: בסדר. ${first(ts1)} יעדכן אותנו, ו${hy2} תשלח את הדוח.`);
  docs.push(d);
}
// transcript 3 ─ longer
{
  const d = new Doc("t3", "transcript", "תמלול דיון");
  const [w1, w1b] = d.ent("P_WORD", "NAME", true, "ניר אסולין", ["ניר אסולין", "ניר"], "lexicon-aided by design");
  const [w2, w2b] = d.ent("P_WORD", "NAME", true, "אור בוזגלו", ["אור בוזגלו", "אור"], "lexicon-aided by design");
  const [e1, e1b] = d.ent("P_ED1_PAIR", "NAME", true, "מורן אביטן", ["מורן אביטן", "אביטן"]);
  const [e2, e2b] = d.ent("P_ED1_PAIR", "NAME", true, "ינון אביתן", ["ינון אביתן", "אביתן"], "one letter from אביטן; a different person");
  const [co] = d.ent("P_CORRUPT_ONLY", "NAME", true, "טיטו וורקו", ["טיטו ווארקו"], "expected to fail: only the corrupted form appears");
  const [nk1, nk2] = d.ent("P_NIKUD", "NAME", true, "מיקה", ["מיקה", NIK_MIKA], "one occurrence carries nikud");
  const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "עמותת שביל הלב", ["עמותת שביל הלב", "שביל הלב"]);
  const [lp] = d.ent("O_LOOKS_PERSON", "ORG", true, "שילה ואופק", ["שילה ואופק"], "a daycare named like two children");
  const [nb, nb2] = d.ent("L_NEIGHBOURHOOD", "PLACE", true, "שכונת הדקלים", ["שכונת הדקלים", "הדקלים"]);
  d.ent("T_IDIOM", "TRAP", false, "אור יום", ["אור יום", "בחיים לא ראיתי"], "אור יום beside אור");
  d.p("תמלול דיון — פרוטוקול")
   .p(`השופט: ${w1}, אתה העד הראשון. ${w2} יעיד אחריך.`)
   .p(`${w1}: ${e1} היא הלקוחה שלי. ${e2}, שכן, הגיש תלונה. ${e1b} ו${e2b} זה לא אותו אדם, ואני מבקש שהפרוטוקול ישקף את זה.`)
   .p(`השופט: ${w2}, מה ראית?`)
   .p(`${w2}: בחיים לא ראיתי דבר כזה. באור יום, ב${nb}, ${co} צעק על הילדה. ${nk1} עמדה ליד השער ובכתה.`)
   .p(`${w1}: ${nk2} בת חמש. היא ב${lp} בבוקר, ואחר הצהריים ב${o1}. ${o1b} כתבה מכתב.`)
   .p(`השופט: ${w2b}, ${w1b}, תודה. ${e2b} יעיד בדיון הבא. ${nb2} תיבדק על ידי קצין המבחן.`)
   .p(`${w1}: אני מבקש שגם ${e1b} תוזמן. ${first(co)} לא ענה לטלפונים.`);
  docs.push(d);
}
// transcript 4 ─ long
{
  const d = new Doc("t4", "transcript", "תמלול ועדה");
  const [pr] = d.ent("P_PROSE", "NAME", true, "ענבר", ["ענבר"], "never before a speech verb");
  const [s1, s1b] = d.ent("P_SHARED_SURNAME", "NAME", true, "מורן רוזנטל", ["מורן רוזנטל", "מורן"]);
  const [s2, s2b] = d.ent("P_SHARED_SURNAME", "NAME", true, "נמרוד רוזנטל", ["נמרוד רוזנטל", "רוזנטל"], "shares a surname with מורן");
  const [et1, et1b] = d.ent("P_ETHIOPIAN", "NAME", true, "מולו טגניה", ["מולו טגניה", "טגניה"]);
  const [et2, et2b] = d.ent("P_ETHIOPIAN", "NAME", true, "אברה ברהנו", ["אברה ברהנו", "ברהנו"]);
  const [mn] = d.ent("P_MINOR", "NAME", true, "עומרי", ["עומרי"], "minor, first name only");
  const [sr, srb] = d.ent("P_SPLITRUN", "NAME", true, "עמיחי אלמגור", ["עמיחי אלמגור", "אלמגור"], "split mid-word across two runs");
  const [lo] = d.ent("P_LOOKS_ORG", "NAME", true, "עומרי גן", ["עומרי גן"], "surname is an org prefix word");
  const [l1] = d.ent("L_TOWN", "PLACE", true, "הר אדר", ["הר אדר"]);
  d.p("תמלול ישיבת ועדה")
   .p(`יו"ר: אנחנו דנים בעניין ${s1} ו${s2}. ${et1} מהלשכה, בבקשה.`)
   .p(`${et1}: תודה. במקרה של ${pr} הפנייה הגיעה מבית הספר. אמא של ${pr} פנתה אלינו, ובשביל ${pr} פתחנו תיק. ${mn} הוא אחיה הקטן.`)
   .p(`${s2}: אני האב. ${s1b} לא מעדכנת אותי. ${s2b} זה גם שמה, אבל אנחנו פרודים.`)
   .p(`${et2}: אני המדריך ב${l1}. ${mn} מגיע לחוג פעמיים בשבוע. ${et1b} מכירה את הילדים.`)
   .p("עמי", `חי אלמגור: אני העו"ס של ${s1b}. ${lo}, הסבא, מוכן לארח. ${srb} זה השם שלי, ${s2b} זה השם שלהם.`)
   .p(`יו"ר: ${et1b}, ${et2b}, תעבירו דוח. ${s2b} יגיש תצהיר. ${first(lo)} הסבא יוזמן. הישיבה נעולה.`);
  docs.push(d);
}

// ── assertions: the key cannot drift, every category is covered, nothing is known ──
const strip = (s) => s.replace(/[֑-ׇ]/g, "");
for (const d of docs) {
  const text = d.text(), plain = strip(text);
  for (const e of d.ents) for (const s of e.surfaces)
    if (!text.includes(s) && !plain.includes(strip(s))) throw new Error(`${d.id}: surface not in text: ${s}`);
}
const cover = {};
for (const d of docs) for (const cat of new Set(d.ents.map((e) => e.cat))) cover[cat] = (cover[cat] || 0) + 1;
for (const cat of Object.keys(C)) if ((cover[cat] || 0) < 3) throw new Error(`category ${cat} appears in ${cover[cat] || 0} documents, need 3`);

const pool = Object.values(E.POOL).flat();
const KNOWN = new Set([...E.FEM, ...E.MASC, ...E.WORDLIKE, ...pool, ...E.KNOWN_FIRST].map((s) => E.norm(s)));
const KNOWN_PLACES = new Set(Object.keys(E.PLACE_BY).map((s) => E.norm(s)));
const bad = [];
for (const d of docs) for (const e of d.ents) {
  if (e.kind === "TRAP" || EXEMPT_FROM_DISJOINT.has(e.cat)) continue;
  if (e.kind === "PLACE") {
    for (const s of e.surfaces) if (KNOWN_PLACES.has(E.norm(s))) bad.push(`${d.id} ${e.cat} place known to PLACE_BY: ${s}`);
    continue;
  }
  const words = strip(e.canonical).replace(/^(עו"ד|ד"ר|גב'|משפחת) /, "").split(/[\s-]+/);
  for (const w of words) if (w.length >= 3 && KNOWN.has(E.norm(w))) bad.push(`${d.id} ${e.cat} name word known to the tool: ${w}`);
}
if (bad.length) throw new Error("disjointness violated:\n  " + bad.join("\n  "));

// ── write ───────────────────────────────────────────────────────────────────
const key = { generated: new Date().toISOString().slice(0, 10), categories: C,
  exemptFromDisjoint: [...EXEMPT_FROM_DISJOINT], expectedFail: [...EXPECTED_FAIL], docs: [] };
for (const d of docs) {
  fs.writeFileSync(path.join(OUT, d.id + ".docx"), Buffer.from(docx(d)));
  fs.writeFileSync(path.join(OUT, d.id + ".txt"), d.text() + "\n");
  key.docs.push({ id: d.id, genre: d.genre, title: d.title, file: `corpus/${d.id}.docx`,
    words: d.text().split(/\s+/).length, entities: d.ents });
}
fs.writeFileSync(path.join(__dirname, "key.json"), JSON.stringify(key, null, 1));
const ents = key.docs.reduce((n, d) => n + d.entities.length, 0);
console.log(`corpus: ${docs.length} documents, ${ents} keyed entities, ${Object.keys(C).length} categories each in ≥3 documents; names disjoint from the tool's lexicons (exempt: ${[...EXEMPT_FROM_DISJOINT].join(", ")})`);
for (const d of key.docs) console.log(`  ${d.id.padEnd(3)} ${d.genre.padEnd(11)} ${String(d.words).padStart(4)} words  ${d.entities.length} entities`);
