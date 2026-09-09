const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* A replacement she typed that is also a real person in the document.

   Until now the tool dropped her choice without a word and picked another
   fake name: "doesn't take". Her decision (Q14): what she typed stands, and
   the card says that two people now share a name, with the two ways out. */

const DOC = [
  "פרוטוקול דיון",
  "רונית לוי: אני מבקשת לפתוח.",
  "דנה ברקוביץ: אני מסכימה עם רונית לוי. גם יעל רוזן הייתה שם.",
  "רונית לוי: תודה. יעל רוזן אישרה את הדברים.",
  "דנה ברקוביץ: נכון.",
].join("\n");

test("a colliding replacement is kept, and the card warns", async ({ page }) => {
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

  const marks = page.locator('[data-mark][data-val="רונית לוי"]');
  await expect(marks.first()).toBeVisible({ timeout: 15000 });
  await marks.first().click();
  const card = page.locator("[data-group]").filter({ hasText: "רונית לוי" }).first();
  const box = card.getByPlaceholder("תחליף").first();
  await expect(box).toBeVisible({ timeout: 10000 });
  await box.fill("יעל רוזן");
  await box.press("Enter");

  // her choice stands in the document
  await expect.poll(() => marks.first().textContent(), { timeout: 15000 }).toBe("יעל רוזן");
  // and the card says so, naming the real person and the two ways out
  const warn = card.locator("[data-collide]");
  await expect(warn).toBeVisible({ timeout: 10000 });
  await expect(warn).toContainText("יעל רוזן");
  await expect(warn).toContainText("תחליף אחר");
});
