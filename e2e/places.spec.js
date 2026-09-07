const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Two findings from a real case file, both on the screens that come before
   the check screen.

   The places screen used to run its own scan of the settlement list without
   the engine's ambiguity guard, so it offered to replace אזור — a town south
   of Tel Aviv, and also the ordinary word for an area. Accepting that screen
   writes a blanket rule, which turned "אזור התעשייה" into a village name.

   And neither that screen nor the people screen showed anything from the
   document, so there was no way to tell which אזור this was. Both now carry
   the sentences the value appears in. */

const DOC = [
  "תסקיר בעניין המשפחה",
  "גדעון לוי מתגורר בחיפה מאז 2019.",
  "הוא עובד באזור התעשייה בנתניה, וכל האזור סבל מהצפות.",
].join("\n");

test("a settlement name that is also an ordinary word is not offered for replacement", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();

  // the places screen: two real towns, and no row for the ordinary word
  const rows = page.locator('div:has(> button:text-is("אל תחליף"))');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });
  const offered = await rows.locator("> span").first().allTextContents();
  const names = await rows.locator('span[data-tip="1"]').allTextContents();
  expect(names).toContain("חיפה");
  expect(names).toContain("נתניה");
  expect(names).not.toContain("אזור");
  expect(offered.length).toBeGreaterThan(0);
});

test("a place row shows the sentences it appears in, on hover and on tap", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();

  const haifa = page.locator('span[data-tip="1"]').filter({ hasText: "חיפה" }).first();
  await expect(haifa).toBeVisible({ timeout: 10000 });
  const panel = page.locator('[data-tip="panel"]');
  await expect(panel).toHaveCount(0);

  // hover shows the sentence from the document
  await haifa.hover();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("מתגורר");

  // moving away closes it again
  await page.locator("h1").first().hover();
  await expect(panel).toHaveCount(0);

  // a tap pins it, so it works where there is no hover
  await haifa.click();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("מתגורר");
  await page.locator("h1").first().hover();
  await expect(panel).toBeVisible();
  await haifa.click();
  await expect(panel).toHaveCount(0);
});

test("a name typed by hand on the people screen carries its sentences too", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });

  await page.getByRole("textbox").first().fill("גדעון לוי");
  await page.getByRole("button", { name: "הוספה", exact: true }).click();

  const chip = page.locator('span[data-tip="1"]').filter({ hasText: "גדעון לוי" }).first();
  await expect(chip).toBeVisible();
  await chip.hover();
  const panel = page.locator('[data-tip="panel"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("מתגורר");
});
