const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Working from the text (Q1) and marks that read without color (Q2).

   She said she prefers the text to the side panel, and on her screen the
   marks were too faint to tell apart. A click on a marked word now opens an
   editor at the word with every action of the card, a live preview of the
   sentence, and the marks carry a shape: solid underline for replaced, dashed
   plus "?" for waiting, ∅ for deleted, with a legend above the document. */

const DOC = [
  "פרוטוקול דיון",
  "רונית לוי: אני מבקשת לפתוח. דיברתי עם דנה ברקוביץ.",
  "דנה ברקוביץ: אני מסכימה עם רונית לוי. נסענו לאזור.",
  "רונית לוי: תודה. אמרתי לדנה ברקוביץ שנחכה.",
  "דנה ברקוביץ: נכון.",
].join("\n");

async function toCheck(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
const sheet = (page) => page.locator("[data-work] section").first();

test("the legend is there, and marks carry a shape as well as a color", async ({ page }) => {
  await toCheck(page);
  await expect(page.locator("[data-legend]")).toContainText("הוחלף");
  const mark = page.locator('[data-mark][data-val="רונית לוי"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  const border = await mark.evaluate((el) => getComputedStyle(el).borderBottomStyle);
  expect(border).toBe("solid");
  // a value waiting for a decision: dashed, and a "?" badge
  const flag = page.locator('[data-mark][data-badge="?"]').first();
  if (await flag.count()) {
    expect(await flag.evaluate((el) => getComputedStyle(el).borderBottomStyle)).toBe("dashed");
  }
});

test("a click on a replaced word opens the editor at the word, with a live preview, and saves", async ({ page }) => {
  await toCheck(page);
  // the prefixed occurrence: the preview must keep the letter and take only the name
  const mark = page.locator('[data-mark][data-val="לדנה ברקוביץ"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  await mark.click();
  const ed = page.locator("[data-inline]");
  await expect(ed).toBeVisible();
  await expect(ed).toContainText("דנה ברקוביץ");
  const box = ed.getByPlaceholder("תחליף אחר");
  await box.fill("מיכל ברנע");
  await expect(ed.locator("[data-inline-preview]")).toContainText("«למיכל ברנע»");
  await box.press("Enter");
  await expect(ed).toHaveCount(0);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("למיכל ברנע");
  expect(await sheet(page).innerText()).toContain("מיכל ברנע");
});

test("the editor offers blank, don't replace, and same-person, and each acts on the document", async ({ page }) => {
  await toCheck(page);
  const mark = page.locator('[data-mark][data-val="רונית לוי"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  await mark.click();
  let ed = page.locator("[data-inline]");
  await expect(ed).toBeVisible();
  await ed.getByRole("button", { name: "ריק", exact: true }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("רונית לוי");
  await expect(page.locator('[data-mark][data-val="רונית לוי"]').first()).toHaveText("∅");
  // the deleted mark opens the editor too, and brings the name back
  await page.locator('[data-mark][data-val="רונית לוי"]').first().click();
  ed = page.locator("[data-inline]");
  await expect(ed).toContainText("נמחק");
  await ed.getByRole("button", { name: "שם", exact: true }).click();
  await expect.poll(() => page.locator('[data-mark][data-val="רונית לוי"]').first().textContent(), { timeout: 15000 }).not.toBe("∅");
  // don't replace from the editor
  await page.locator('[data-mark][data-val="דנה ברקוביץ"]').first().click();
  ed = page.locator("[data-inline]");
  await ed.getByRole("button", { name: "אל תחליף" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("דנה ברקוביץ");
});

test("a click on ordinary text closes the editor", async ({ page }) => {
  await toCheck(page);
  const mark = page.locator('[data-mark][data-val="רונית לוי"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  await mark.click();
  await expect(page.locator("[data-inline]")).toBeVisible();
  await sheet(page).locator("p").first().click({ position: { x: 5, y: 5 } });
  await expect(page.locator("[data-inline]")).toHaveCount(0);
});
