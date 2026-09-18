const { test, expect } = require("./base");
const H = require("./helpers");

/* Release 5: the client's third session (16.9). Dates, prefix letters, one
   card per person, name parts, allow shielding and "same person" by part. */

const sheet = (page) => page.locator("[data-work] section").first();
const cards = (page) => page.locator("[data-group]");
// the card title is its first span; textContent of the card starts with template whitespace, so no ^ anchors
// a card by its title span, not by any text inside it (context lines quote other names)
const cardOf = (page, title) => page.locator("[data-group]").filter({ has: page.locator("span:first-child", { hasText: new RegExp("^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }) }).first();
const titles = (page) => page.evaluate(() => [...document.querySelectorAll("[data-group]")].map((g) => (g.querySelector("span") || {}).textContent || ""));

async function toWork(page, doc, names) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of names || []) { await input.fill(n); await input.press("Enter"); }
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}
async function manualAdd(page, value) {
  await page.getByPlaceholder("ערך שפוספס").fill(value);
  await page.getByRole("button", { name: "הוספה והחלפה" }).click();
}

const DOC = [
  "פרוטוקול",
  "מרים לוין: אני מבקשת לפתוח. הפגישה נקבעה ל-14.3.2026.",
  "מרים לוין: למרים יש טענות, ומרים תגיש אותן. שלחתי מכתב למרים לוין.",
  "דוד כהן: אני מסכים עם מרים.",
  "דוד כהן: נמשיך.",
].join("\n");

test("one card per person: the prefixed forms are chips, and one form can be kept alone", async ({ page }) => {
  await toWork(page, DOC);
  // one card for מרים לוין, none for "למרים לוין"
  await expect.poll(() => titles(page)).toContain("מרים לוין");
  const ts = await titles(page);
  expect(ts.filter((t) => t === "מרים לוין")).toHaveLength(1);
  expect(ts).not.toContain("למרים לוין");
  const card = cards(page).filter({ hasText: "מרים לוין" }).first();
  const forms = card.locator("[data-forms] [data-form]");
  expect(await forms.count()).toBeGreaterThanOrEqual(2);
  // the prefixed form shows its letter apart from the name
  const lForm = forms.filter({ hasText: "למרים לוין" }).first();
  await expect(lForm.locator("span").first()).toHaveText("ל");
  // keep only that form
  await lForm.click();
  await card.locator("[data-form-act]").getByRole("button", { name: "אל תחליף" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("למרים לוין");
  const text = await sheet(page).innerText();
  expect(text).not.toMatch(/(^|[^ל])מרים לוין/);
});

test("the prefix letter is shown apart from the name in the text and in the editor, and the box holds the name only", async ({ page }) => {
  await toWork(page, DOC);
  const mark = page.locator('[data-mark][data-val="למרים לוין"]').first();
  await expect(mark).toBeVisible();
  await expect(mark.locator("[data-pre]")).toHaveText("ל");
  const rep = (await mark.innerText()).trim();
  expect(rep.startsWith("ל")).toBe(true);
  await mark.click();
  const ed = page.locator("[data-inline]");
  await expect(ed.locator("[data-pre-chip]")).toHaveText("ל");
  await expect(ed.locator("[data-inline-pre]").first()).toHaveText("ל");
  await ed.getByPlaceholder("תחליף אחר").fill("בתיה נחמיאס");
  await expect(ed.locator("[data-inline-preview]")).toContainText("«לבתיה נחמיאס»");
  await ed.getByPlaceholder("תחליף אחר").press("Enter");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("לבתיה נחמיאס");
  expect(await sheet(page).innerText()).not.toContain("ללבתיה");
});

test("a shifted date has its own mark and legend entry", async ({ page }) => {
  await toWork(page, DOC);
  const d = page.locator('[data-mark][data-kind="date"]').first();
  await expect(d).toBeVisible();
  expect(await d.innerText()).not.toBe("14.3.2026");
  expect(await d.evaluate((el) => getComputedStyle(el).borderBottomStyle)).toBe("dotted");
  await expect(page.locator("[data-legend-date]")).toBeVisible();
  await expect(d).toHaveAttribute("title", /תאריך מוזז/);
});

test("the dates choice is one setting, and it is kept with the case", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await page.getByLabel("תאריכים").selectOption("blank");
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-mark][data-kind="date"]')).toHaveCount(0);
  expect(await sheet(page).innerText()).not.toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/);
  await expect(page.locator("[data-legend-date]")).toHaveCount(0);
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("לוין נ׳ לוין");
  await expect.poll(() => page.evaluate(() => { const c = JSON.parse(localStorage.getItem("redact-cases") || "{}"); return c["לוין נ׳ לוין"] && c["לוין נ׳ לוין"].styles && c["לוין נ׳ לוין"].styles.date; })).toBe("blank");
  // the next document of the case starts with the same choice
  await page.reload();
  await expect(page.getByLabel("תאריכים")).toHaveValue("name");
  await page.getByRole("button", { name: "שימוש בתיק הזה", exact: true }).first().click();
  await expect(page.getByLabel("תאריכים")).toHaveValue("blank");
});

test("an unambiguous first name of a listed full name is replaced without review", async ({ page }) => {
  await toWork(page, DOC);
  // "דוד" alone is the first name of דוד כהן, who is listed; "מרים" alone of מרים לוין
  const text = await sheet(page).innerText();
  expect(text).not.toMatch(/(^|[^א-ת])מרים($|[^א-ת])/);
  await expect(page.locator("[data-bar]")).not.toContainText("ממתינים להחלטה");
});

test("'לא שם' on a longer span does not shield a listed name inside it", async ({ page }) => {
  const D = ["פרוטוקול", "עדי ברקוביץ: פתחתי.", "עדי ברקוביץ: סיימתי. אמרתי לעדי שזה בסדר."].join("\n");
  await toWork(page, D);
  // reject the full name as "not a name": it goes to the allow list
  const card = cardOf(page, "עדי ברקוביץ");
  await card.getByRole("button", { name: /לא שם/ }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("עדי ברקוביץ");
  // then list the first name by hand: it is replaced everywhere, including inside the rejected span
  await manualAdd(page, "עדי");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toMatch(/עדי ברקוביץ/);
  expect(await sheet(page).innerText()).not.toMatch(/(^|[^א-ת])עדי($|[^א-ת])/);
});

test("'same person' from a prefixed short form takes the first name only and keeps the letter", async ({ page }) => {
  const D = ["פרוטוקול", "רן אלון: פתחתי.", "רן אלון: סיימתי. שרן אמר שזה בסדר."].join("\n");
  await toWork(page, D);
  await manualAdd(page, "שרן");
  await expect.poll(() => titles(page)).toContain("שרן");
  const card = cardOf(page, "שרן");
  // adding from the rail already selects the new card; a click would close it
  // click the title, not the card's centre, which now sits on the action buttons
  if (!(await card.getByRole("combobox").first().isVisible().catch(() => false))) await card.locator("span:first-child").first().click();
  await card.getByRole("combobox").first().selectOption("רן אלון");
  const full = (await page.locator('[data-mark][data-val="רן אלון"]').first().innerText()).trim();
  const [first, last] = full.split(" ");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("ש" + first + " אמר");
  expect(await sheet(page).innerText()).not.toContain("ש" + first + " " + last);
});

// a name that took an extra word: "מרים להידחות". The engine no longer builds it,
// so the tests add it by hand and trim it back, from each of the three places.
const SPAN = ["פרוטוקול", "מרים לוין: פתחתי.", "מרים לוין: סיימתי.", "לדעתי דין הבקשה של מרים להידחות, ומרים תגיש ערעור."].join("\n");

test("trim on the card: the extra word goes back to the text, the pseudonym keeps its first part", async ({ page }) => {
  await toWork(page, SPAN, ["מרים להידחות"]);
  const card = cardOf(page, "מרים להידחות");
  await expect(card).toBeVisible();
  const fake = (await page.locator('[data-mark][data-val="מרים להידחות"]').first().innerText()).trim();
  expect(fake.split(" ").length).toBe(2);
  await card.locator("[data-words] [data-word]", { hasText: "להידחות" }).click();
  await expect.poll(() => titles(page), { timeout: 15000 }).not.toContain("מרים להידחות");
  const text = await sheet(page).innerText();
  expect(text).toContain(fake.split(" ")[0] + " להידחות");
  expect(text).not.toContain(fake);
  expect(text).not.toMatch(/(^|[^א-ת])מרים($|[^א-ת])/);
});

test("trim from the inline editor", async ({ page }) => {
  await toWork(page, SPAN, ["מרים להידחות"]);
  await page.locator('[data-mark][data-val="מרים להידחות"]').first().click();
  const ed = page.locator("[data-inline]");
  await ed.locator("[data-inline-words] [data-word]", { hasText: "להידחות" }).click();
  await expect(ed).toHaveCount(0);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toMatch(/ להידחות/);
  expect(await sheet(page).innerText()).not.toMatch(/(^|[^א-ת])מרים($|[^א-ת])/);
});

test("trim on the people screen chip", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", SPAN);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("מרים להידחות");
  await input.press("Enter");
  expect(await H.listedNames(page)).toContain("מרים להידחות");
  const row = H.peopleRows(page).filter({ hasText: "מרים להידחות" }).first();
  await row.getByRole("button", { name: "קיצור השם" }).click();
  await page.locator("[data-trim-row] [data-word]", { hasText: "להידחות" }).click();
  const names = await H.listedNames(page);
  expect(names).toContain("מרים");
  expect(names).not.toContain("מרים להידחות");
  await expect(page.locator("[data-trim-row]")).toHaveCount(0);
});
