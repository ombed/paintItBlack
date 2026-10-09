/* Dates in every usual spelling are found, shifted and restored.

   Until now only a numeric date with a year was a date: «12.3.2026», «12/03/26». A date in words
   («12 במרץ 2026»), with hyphens («12-03-2026»), year first («2026-03-12») or without a year
   («ביום 12.3», «12 במרץ») reached the AI as it was, real (found by the owner on 9.10, in the
   home page's example, which shows «ביום 12.3» unchanged because the tool leaves it so).
   The class: one value, written in another usual form of itself. A day and month without a year
   look like a clause number («סעיף 12.3») or a decimal, so the numeric form counts only after a
   word that announces a date; a month's name is evidence enough by itself. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(a === b, m + " — got «" + a + "», want «" + b + "»");
const OPT = { on: new Set(["DATE"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const run = (text) => { const eng = new C.Engine([], [], OPT, text); return { eng, hits: eng.detect(text).filter((h) => h.type === "DATE") }; };
const found = (text) => run(text).hits.map((h) => h.text);

console.log("\n— found: every usual spelling of a date —");
for (const [text, want] of [
  ["הדיון התקיים ב-12 במרץ 2026 בבית המשפט.", "12 במרץ 2026"],
  ["הדיון התקיים ב-12 במרס 2026.", "12 במרס 2026"],
  ["נדחה ל-12 למרץ 2026.", "12 למרץ 2026"],
  ["ביום 12 מרץ 2026 הוגשה הבקשה.", "12 מרץ 2026"],
  ["ביום 1 בינואר, 2026 הוגשה הבקשה.", "1 בינואר, 2026"],
  ["הוגש ביום 12-03-2026.", "12-03-2026"],
  ["הוגש ביום 12-3-26.", "12-3-26"],
  ["הוגש ביום 2026-03-12.", "2026-03-12"],
  ["נפגשו ב-12 במרץ ודיברו.", "12 במרץ"],
  ["עד ה-12 במרץ יוגש התצהיר.", "12 במרץ"],
  ["ביום 12.3 נפגשה עו״ד נעמה ברק עם אלון שפירא.", "12.3"],
  ["מיום 12/3 ואילך.", "12/3"],
  ["בתאריך 12.3 התקיימה פגישה.", "12.3"],
  ["תאריך: 12.3", "12.3"],
  ["עד ליום 12.3 יוגש.", "12.3"],
  ["עד ה-12.3 יוגש.", "12.3"],
  ["עד ה־12.3 יוגש.", "12.3"],
  ["ביום 12.3.2026 נפגשו.", "12.3.2026"],
]) eq(found(text).join(" | "), want, "«" + text + "»");

console.log("\n— left alone: numbers that are not dates —");
for (const text of [
  "לפי סעיף 12.3 להסכם.", "תקנה 4.2 קובעת.", "סכום של 2.5 מיליון.", "עד 2.5 מיליון ש״ח.", "גרסה 1.2 של המסמך.",
  "ב-12.3% מהמקרים.", "חצה את רף ה-4.1 מיליון.", "דירות ה- 2.5 חדרים.", "מה-1.5 ש״ח עד ה-2.5 ש״ח.", 'תמ"ש 12345-03-26 נקבע.', "טלפון 03-1234567.", "רכב 12-345-67.",
  "ביום 32.3 לא היה.", "ביום 12.13 לא היה.", "13-13-2026 אינו תאריך.", "ב-32 במרץ 2026.", "3 מרצים הגיעו.",
]) eq(found(text).join(" | "), "", "«" + text + "»");
eq(found("ביום 12.3.2026 נפגשו.").length, 1, "a full date is one date, not also its day and month");

console.log("\n— shifted, in the document's own spelling —");
for (const [real, off, want] of [
  ["11.2.2026", 45, "28.3.2026"], ["1/9/26", 100, "10/12/26"],
  ["05.03.2026", 1, "06.03.2026"], ["11-02-2026", 45, "28-03-2026"], ["2026-02-11", 45, "2026-03-28"],
  ["11 בפברואר 2026", 45, "28 במרץ 2026"], ["11 בפברואר, 2026", 45, "28 במרץ, 2026"],
  ["11 לפברואר 2026", 45, "28 למרץ 2026"], ["11 פברואר 2026", 45, "28 מרץ 2026"],
  ["1 במרס 2026", 1, "2 במרס 2026"], ["28 בפברואר 2026", 1, "1 במרץ 2026"], ["31 בדצמבר 2025", 1, "1 בינואר 2026"],
  ["11.2", 45, "28.3"], ["11/2", 45, "28/3"], ["11 בפברואר", 45, "28 במרץ"], ["31.12", 1, "1.1"], ["29.2", 1, "1.3"],
]) eq(C.fakeDate(real, off), want, real + " + " + off + " days");
for (const bad of ["31 בפברואר 2026", "31.2.2026", "30.2"]) eq(C.fakeDate(bad, 10), null, "an impossible date is not shifted: " + bad);

console.log("\n— one document, one offset, every spelling —");
{
  const text = "הדיון ב-11.2.2026, ההחלטה ב-25 בפברואר 2026, התגובה עד ה-1.3 והערעור ב-2026-03-15.";
  const { eng, hits } = run(text);
  eq(hits.map((h) => h.text).join(" | "), "11.2.2026 | 25 בפברואר 2026 | 1.3 | 2026-03-15", "all four dates found");
  const reps = hits.map((h) => eng.repFor(h));
  ok(eng.dateOff >= 30 && eng.dateOff <= 400, "the offset is 30–400 days: " + eng.dateOff);
  for (let i = 0; i < hits.length; i++) eq(reps[i], C.fakeDate(hits[i].text, eng.dateOff), "the same offset for «" + hits[i].text + "»");
}
{
  const text = "ביום 12.3 נפגשה עו״ד נעמה ברק עם אלון שפירא.";
  const { eng, hits } = run(text);
  const rep = hits.length ? eng.repFor(hits[0]) : "(not found)";
  ok(/^\d{1,2}\.\d{1,2}$/.test(rep) && rep !== "12.3", "the home page's example: «12.3» goes out as another day and month: " + rep);
}

console.log("\n— restored, also in the AI's own spelling —");
{
  const P = [["12 במרץ 2026", "27 באפריל 2026"]];
  for (const said of ["27 באפריל 2026", "27.4.2026", "27/04/2026", "2026-04-27", "27 לאפריל 2026"])
    eq(C.restoreNames("הדיון נקבע ל-" + said + ".", P).text, "הדיון נקבע ל-12 במרץ 2026.", "a date in words, written by the AI as «" + said + "»");
  const N = [["12.3", "27.4"]];
  for (const said of ["27.4", "27/4", "27 באפריל", "27.04"])
    eq(C.restoreNames("ביום " + said + " נפגשו.", N).text, "ביום 12.3 נפגשו.", "a day and month without a year, written as «" + said + "»");
  for (const t of ["ביום 27/4/2026 נפגשו.", "ביום 28.4 נפגשו.", "ביום 4.27 נפגשו.", "ב-27 באפריל 2026."])
    eq(C.restoreNames(t, N).text, t, "not the shifted day and month as it went out, left alone: «" + t + "»");
  const I = [["2026-03-12", "2026-04-27"]];
  eq(C.restoreNames("ב-27.4.2026 ושוב ב-2026-04-27.", I).text, "ב-2026-03-12 ושוב ב-2026-03-12.", "year first, and the AI's other spelling of it");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
