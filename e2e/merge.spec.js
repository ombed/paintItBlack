const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Two spellings of one woman on the people screen (Q12).

   The engine used to merge them silently. Now the people screen offers the
   merge with its reason, and nothing happens until she taps. After the tap
   the two chips share one fake name on the check screen; "two people" is
   remembered and not asked again. */

const DOC = [
  "פרוטוקול דיון",
  "שלוה ליבוביץ: אני מבקשת לפתוח.",
  "דנה ברקוביץ: אני מסכימה עם שלווה ליבוביץ.",
  "שלוה ליבוביץ: תודה.",
  "דנה ברקוביץ: נכון.",
].join("\n");

async function toPeople(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("שלווה ליבוביץ"); await input.press("Enter");
}

async function toCheck(page) {
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("a merge is suggested with its reason, and one tap gives both one name", async ({ page }) => {
  await toPeople(page);
  const sug = page.locator("[data-merge-sug]").first();
  await expect(sug).toBeVisible();
  await expect(sug).toContainText("כתיב מלא מול חסר");
  await sug.getByRole("button", { name: /אותו אדם/ }).click();
  await expect(page.locator("[data-merge-sug]")).toHaveCount(0);
  // the chip says which name it now follows
  await expect(H.peopleRows(page).filter({ hasText: "שלוה ליבוביץ" }).first()).toContainText("= שלווה ליבוביץ");
  await toCheck(page);
  // one fake name at all three spots: the marks of a merged pair share the card
  // of the name they follow, so the test reads the sheet rather than data-val
  const marks = page.locator('[data-mark][data-val="שלוה ליבוביץ"]');
  await expect(marks.first()).toBeVisible({ timeout: 15000 });
  const fake = await marks.first().textContent();
  const text = await page.locator("[data-work] section").first().innerText();
  expect(text).not.toContain("שלוה ליבוביץ");
  expect(text).not.toContain("שלווה ליבוביץ");
  expect(text.split(fake).length - 1).toBe(3);
});

test("nothing merges on its own, and 'two people' is remembered", async ({ page }) => {
  await toPeople(page);
  const sug = page.locator("[data-merge-sug]").first();
  await expect(sug).toBeVisible();
  await sug.getByRole("button", { name: /שני אנשים/ }).click();
  await expect(page.locator("[data-merge-sug]")).toHaveCount(0);
  await toCheck(page);
  const a = await page.locator('[data-mark][data-val="שלוה ליבוביץ"]').first().textContent();
  const b = await page.locator('[data-mark][data-val="שלווה ליבוביץ"]').first().textContent();
  expect(a).not.toBe(b);
});
