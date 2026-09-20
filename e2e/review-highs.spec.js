const { test, expect } = require("./base");
const H = require("./helpers");

/* Findings of the outside review of 2026-09-20 that she would meet on the check screen. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

async function toCheck(page, doc) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
}

/* H3: a brace-less else let the redacted sheet overwrite the original one, so «מקור» lit up
   and went on showing pseudonyms. Realistic Hebrew pseudonyms made that impossible to notice. */
test("«מקור» shows the original text, and «מושחר» brings the redacted text back", async ({ page }) => {
  await toCheck(page, DOC);
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).not.toContainText("רונית לוי");
  const redacted = await sheet.innerText();

  await page.getByRole("button", { name: "מקור", exact: true }).click();
  await expect(sheet).toContainText("רונית לוי הגישה בקשה לצו הגנה.");
  const lines = (await sheet.innerText()).split("\n").map((x) => x.trim()).filter(Boolean);
  for (const p of DOC.split("\n")) expect(lines).toContain(p);
  await expect(sheet.locator("[data-mark]")).toHaveCount(0);

  await page.getByRole("button", { name: "מושחר", exact: true }).click();
  await expect(sheet).not.toContainText("רונית לוי");
  expect(await sheet.innerText()).toBe(redacted);
});
