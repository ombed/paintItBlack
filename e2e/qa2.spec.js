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

test("H1: '‹ רשימת השמות' and 'המשך' keep every decision made on the work screen", async ({ page }) => {
  const DOC2 = [
    "פרוטוקול דיון בעניין הקטינה דנה ברקוביץ׳",
    "שירה ברקוביץ׳: אני מבקשת לפתוח. אנחנו גרים בחיפה.",
    "רחל פרידמן: דנה ברקוביץ׳ מסתדרת בכיתה, ונוסעת לנשר.",
    "שירה ברקוביץ׳: תודה.",
    "רחל פרידמן: בבקשה.",
  ].join("\n");
  await toWork(page, DOC2);
  // decision 1: a pseudonym of her own
  await page.locator('[data-mark][data-val="שירה ברקוביץ׳"]').first().click();
  await page.locator("[data-inline]").getByPlaceholder("תחליף אחר").fill("גלית ורד");
  await page.locator("[data-inline]").getByPlaceholder("תחליף אחר").press("Enter");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("גלית ורד");
  // decision 2: a name the list missed, added from the work screen
  await page.getByPlaceholder("ערך שפוספס").fill("דנה ברקוביץ׳");
  await page.getByRole("button", { name: "הוספה והחלפה" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("דנה ברקוביץ׳");
  // the toolbar counter ("2 / 8") is part of the pane and moves with the cursor; the text is what matters
  const text = async () => (await sheet(page).innerText()).replace(/\d+ \/ \d+/g, "");
  const before = await text();
  expect(before).not.toContain("חיפה");

  // back to the list: it shows the added name, and continuing changes nothing
  await page.getByRole("button", { name: /רשימת השמות/ }).click();
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  expect(await H.listedNames(page)).toContain("דנה ברקוביץ׳");
  await onward(page);
  await expect.poll(text, { timeout: 15000 }).toBe(before);
  const after = await text();
  expect(after).toContain("גלית ורד");
  expect(after).not.toContain("דנה ברקוביץ׳");
  expect(after).not.toContain("חיפה");
  expect(after).toBe(before);
});

test("H2: back to 'קובץ' and the main button again returns to the same list, not a fresh scan", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC + "\nהקטינה דנה ברקוביץ׳ נכחה. עו\"ד רונן אלמליח ייצג.");
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  // one suggestion dismissed, one added, two names typed
  const sug = page.locator("[data-sug]").or(page.getByRole("button", { name: /^\+ / }));
  await expect(sug.first()).toBeVisible();
  const dismissed = (await page.getByRole("button", { name: /^\+ / }).first().innerText()).replace(/^\+\s*/, "").trim();
  await page.getByRole("button", { name: "לא אדם" }).first().click();
  const addBtn = page.getByRole("button", { name: /^\+ / }).first();
  const added = (await addBtn.innerText()).replace(/^\+\s*/, "").trim();
  await addBtn.click();
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of ["עמוס ברק", "תמר גולן"]) { await input.fill(n); await input.press("Enter"); }
  const before = await H.listedNames(page);
  expect(before).toContain(added);
  expect(before).toContain("תמר גולן");
  expect(before).not.toContain(dismissed);

  await page.getByRole("button", { name: /‹ קובץ/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("מה יוצא מהמסמך");
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  expect(await H.listedNames(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "+ " + dismissed })).toHaveCount(0);
});
