const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Second independent QA audit of the live site (qa-audit/run-2). One test per
   Critical / High issue, each asserting what the user actually gets. */

// three people who each speak twice, so the list fills without the model
const DOC = [
  "פרוטוקול דיון",
  "שירה ברקוביץ׳: אני מבקשת לפתוח את הדיון.",
  "רחל פרידמן: אני המורה של הילדה.",
  "לאה ברקוביץ׳: אני הסבתא, ואני עוזרת.",
  "שירה ברקוביץ׳: תודה לרחל פרידמן וללאה ברקוביץ׳.",
  "רחל פרידמן: היא מסתדרת בכיתה.",
  "לאה ברקוביץ׳: אני אוספת אותה בימי שלישי.",
].join("\n");
const PEOPLE = ["שירה ברקוביץ׳", "רחל פרידמן", "לאה ברקוביץ׳"];

const sheet = (page) => page.locator("[data-work] section").first();
const repOf = (page, val) => page.locator(`[data-mark][data-val="${val}"]`).first().innerText();

async function toWork(page, doc = DOC) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await afterList(page);
}
// the places screen comes when the document has towns; either way, end on the work screen
async function afterList(page) {
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}

test("C1: changing one person's pseudonym leaves everyone else's alone, and the earlier AI answer still restores them", async ({ page }) => {
  await toWork(page);
  const before = {};
  for (const p of PEOPLE) before[p] = (await repOf(page, p)).trim();
  for (const p of PEOPLE) expect(before[p]).not.toBe(p);

  // the AI answer written against the text as first copied
  const answer = `לדעתי ${before["שירה ברקוביץ׳"]} צריכה לדבר עם המורה ${before["רחל פרידמן"]}. הסבתא ${before["לאה ברקוביץ׳"]} יכולה לעזור.`;

  // change only שירה, from the document
  await page.locator('[data-mark][data-val="שירה ברקוביץ׳"]').first().click();
  const ed = page.locator("[data-inline]");
  await expect(ed).toBeVisible();
  await ed.getByPlaceholder("תחליף אחר").fill("גלית ורד");
  await ed.getByPlaceholder("תחליף אחר").press("Enter");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("גלית ורד");

  // the other two people read exactly as before
  expect((await repOf(page, "רחל פרידמן")).trim()).toBe(before["רחל פרידמן"]);
  expect((await repOf(page, "לאה ברקוביץ׳")).trim()).toBe(before["לאה ברקוביץ׳"]);

  // and the answer to the text she already sent comes back with the right people
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(answer);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  const out = page.locator("[data-rv-out]");
  await expect(out).toContainText("המורה רחל פרידמן");
  await expect(out).toContainText("הסבתא לאה ברקוביץ׳");
  await expect(out).not.toContainText("רחל נחום");
});

const A = ["פרוטוקול א", "אבנר שטרן: הגעתי לפגישה.", "אבנר שטרן: חתמתי על ההסכם."].join("\n");
const B = ["פרוטוקול ב", "אבנר שטרן: שלחתי מכתב.", "שושנה ברקאי: הגבתי למכתב.", "אבנר שטרן: ביקשתי דחייה.", "שושנה ברקאי: הסכמתי."].join("\n");
const C = ["פרוטוקול ג", "שושנה ברקאי: הגעתי לבדי.", "שושנה ברקאי: חתמתי."].join("\n");
const cases = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}"));

// the case is chosen on the entry screen, then the next document is loaded
async function nextDocWithCase(page, doc) {
  await page.reload();
  await page.getByRole("button", { name: "שימוש בתיק הזה", exact: true }).first().click();
  await expect(page.locator("[data-case-chip]")).toContainText("שטרן נ׳ שטרן");
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "next.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
async function onward(page) {
  await H.goOn(page);
  await afterList(page);
}

test("C2: a saved case keeps its people and their pseudonyms across documents", async ({ page }) => {
  await toWork(page, A);
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("שטרן נ׳ שטרן");
  // a pseudonym she chose herself
  await page.locator('[data-mark][data-val="אבנר שטרן"]').first().click();
  await page.locator("[data-inline]").getByPlaceholder("תחליף אחר").fill("יוני כהן");
  await page.locator("[data-inline]").getByPlaceholder("תחליף אחר").press("Enter");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("יוני כהן");
  expect((await cases(page))["שטרן נ׳ שטרן"].map["אבנר שטרן"]).toBe("יוני כהן");

  // document B, same person plus a new one: he is on the list already, and keeps his name
  await nextDocWithCase(page, B);
  expect(await H.listedNames(page)).toContain("אבנר שטרן");
  await onward(page);
  expect((await repOf(page, "אבנר שטרן")).trim()).toBe("יוני כהן");
  let map = (await cases(page))["שטרן נ׳ שטרן"].map;
  expect(map["אבנר שטרן"]).toBe("יוני כהן");
  expect(map["שושנה ברקאי"]).toBeTruthy();
  const shoshana = map["שושנה ברקאי"];

  // document C mentions only שושנה: the case still remembers אבנר, and she reads as before
  await nextDocWithCase(page, C);
  await onward(page);
  expect((await repOf(page, "שושנה ברקאי")).trim()).toBe(shoshana);
  map = (await cases(page))["שטרן נ׳ שטרן"].map;
  expect(map["אבנר שטרן"]).toBe("יוני כהן");
  expect(map["שושנה ברקאי"]).toBe(shoshana);
});

test("C3: 'מסמך חדש' drops the case, so the next client's document does not write into it", async ({ page }) => {
  const FIRST = ["פרוטוקול לקוחה א", "אלון בר: הגעתי.", "אלון בר: חתמתי."].join("\n");
  const OTHER = ["פרוטוקול לקוח ב", "אבנר שטרן: הגעתי.", "אבנר שטרן: חתמתי."].join("\n");
  await toWork(page, FIRST);
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("לוי נ׳ לוי");
  await expect.poll(() => cases(page).then((c) => Object.keys(c))).toContain("לוי נ׳ לוי");
  const alon = (await cases(page))["לוי נ׳ לוי"].map["אלון בר"];
  expect(alon).toBeTruthy();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("מה יוצא מהמסמך");
  // the case is offered, not assumed
  await expect(page.getByRole("button", { name: "שימוש בתיק הזה", exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-case-chip]")).toHaveCount(0);

  await H.upload(page, "other.docx", OTHER);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-case-field] input")).toHaveValue("");
  await onward(page);
  const c = (await cases(page))["לוי נ׳ לוי"];
  expect(c.map["אלון בר"]).toBe(alon);
  expect(c.map["אבנר שטרן"]).toBeUndefined();
  expect(c.rules.map((r) => r.value)).not.toContain("אבנר שטרן");
});
