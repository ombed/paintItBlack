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
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
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
