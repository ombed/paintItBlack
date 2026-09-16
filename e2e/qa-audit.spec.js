const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* From the independent QA audit (qa-audit/run-1).

   ISSUE-001 (critical): after attaching a saved case from "תיקים אחרונים",
   "החזרת שמות" consulted the saved case's map instead of the current
   document's, so the pseudonym the tool had just written could not be found
   and the text came back unchanged with "לא נמצא אף שם חלופי".

   ISSUE-002 (high): a name ending in geresh ("יואב ברקוביץ׳") lost its ׳ when
   added, never matched the document, and the real name stayed in the output. */

const DOC1 = ["סיכום", "מר גדי פרץ הגיע לפגישה. גדי פרץ חייך."].join("\n");
const DOC2 = ["סיכום", "מר עמוס ברק הגיע לפגישה. עמוס ברק חייך."].join("\n");

async function boot(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
}
async function scanAndList(page, name) {
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill(name); await input.press("Enter");
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
const sheet = (page) => page.locator("[data-work] section").first();

test("ISSUE-001: restore finds the current document's pseudonyms after a saved case was attached", async ({ page }) => {
  await boot(page);
  await H.upload(page, "first.docx", DOC1);
  await scanAndList(page, "גדי פרץ");
  // name the case: the profile is persisted to the browser on every change
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("פרץ נ׳ פרץ");
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")))).toContain("פרץ נ׳ פרץ");

  // second document: attach the saved case from the banner
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await H.upload(page, "second.docx", DOC2);
  const banner = page.locator("div").filter({ hasText: /תיקים אחרונים/ }).getByRole("button", { name: "המשך", exact: true }).first();
  await expect(banner).toBeVisible({ timeout: 10000 });
  await banner.click();
  await scanAndList(page, "עמוס ברק");

  // the pseudonym the tool wrote for the new person
  const mark = page.locator('[data-mark][data-val="עמוס ברק"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  const fake = (await mark.textContent()).trim();
  expect(fake).not.toBe("עמוס ברק");

  // paste an answer that uses it, and restore
  await page.getByRole("button", { name: /החזרת שמות מתשובת AI/ }).click();
  await page.getByPlaceholder(/הדבקת תשובת ה-AI/).fill(`להערכתי, ${fake} צריך להגיש את התצהיר.`);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.getByText(/לא נמצא אף שם חלופי/)).toHaveCount(0);
  await expect(page.locator("main")).toContainText("להערכתי, עמוס ברק צריך להגיש את התצהיר.");
});
