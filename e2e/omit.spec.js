const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Omission, as she asked for it: numbers and dates gone by default, a
   person gone when she says so, ages kept, and every choice visible and
   reversible on the check screen. */

const DOC = [
  "פרוטוקול דיון",
  "רונית לוי: אני מבקשת לפתוח. הבת שלי בת 9.",
  "רונית לוי: מספר הזהות שלי 314277062, והדיון הקודם היה ב-11.2.2026.",
  "דנה ברקוביץ: נכון. אני זוכרת.",
  "דנה ברקוביץ: תודה.",
].join("\n");

async function toCheck(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

const sheet = (page) => page.locator("[data-work] section").first();

test("numbers and dates are deleted by default; the age stays; a mark shows where", async ({ page }) => {
  await toCheck(page);
  const text = await sheet(page).innerText();
  expect(text).not.toContain("314277062");
  expect(text).not.toContain("11.2.2026");
  expect(text).not.toContain("[ת");           // no bracketed label either
  expect(text).toContain("בת 9");             // the age survives
  // the spot is marked, and the mark names what was there
  const del = page.locator('[data-mark][data-val="314277062"]');
  await expect(del.first()).toBeVisible();
  expect(await del.first().textContent()).toBe("∅");
});

test("blank on a person deletes her and warns that restore cannot bring her back", async ({ page }) => {
  await toCheck(page);
  const mark = page.locator('[data-mark][data-val="רונית לוי"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  await mark.click();
  const card = page.locator("[data-group]").filter({ hasText: "רונית לוי" }).first();
  await card.getByRole("button", { name: "ריק", exact: true }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("רונית לוי");
  await expect(card).toContainText("תשובת ה-AI לא תוכל להחזיר");
  // and the fake name is gone too: the text reads without her
  const text = await sheet(page).innerText();
  expect(text).toContain("אני מבקשת לפתוח");
});

test("the mode panel can turn numbers into labels instead", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await page.locator("select").filter({ hasText: "נמחקים מהטקסט" }).first().selectOption("label");
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const text = await sheet(page).innerText();
  expect(text).not.toContain("314277062");
  expect(text).toMatch(/\[ת"ז|\[ת״ז|\[תעודת/);
});
