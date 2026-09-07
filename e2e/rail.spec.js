const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Four complaints about the check screen, from a real session.

   The manual add-a-replacement card was hard-coded below all five accordions
   and was the only card that could not be collapsed, so it sat about a screen
   below the fold exactly when she had just spotted a missed value.

   The audit bundle lived in the fifth and last section, collapsed, under a
   heading about what was cleaned from the file, inside a sub-box called
   sending for review. Her words: if I searched and did not find it, she would
   never find it.

   And the bottom bar floated over the document and the rail, with the space
   left for it hardcoded in three places that nothing tied to its real height.
   On a phone it wraps to several lines and covered the bottom of the sheet. */

const DOC = ["תסקיר בעניין המשפחה", "רונית לוי הגישה בקשה.", "הדיון נקבע בחיפה."].join("\n");

async function toCheckScreen(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
  if (await run.isVisible().catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("adding a missed value by hand sits at the top of the rail", async ({ page }) => {
  await toCheckScreen(page);
  const manual = page.getByPlaceholder("ערך שפוספס");
  await expect(manual).toBeVisible();

  // above the first accordion, rather than below all of them
  const manualTop = await manual.boundingBox();
  const firstSection = page.getByRole("button", { name: /לבדיקה|מה נמצא והוחלף/ }).first();
  const sectionTop = await firstSection.boundingBox();
  expect(manualTop.y).toBeLessThan(sectionTop.y);
});

test("the bundle export is its own section, open, and says what it is", async ({ page }) => {
  await toCheckScreen(page);
  // visible without opening anything
  await expect(page.getByRole("button", { name: /חבילת בדיקה/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /העתקת יומן הסשן/ })).toBeVisible();
  // and it is no longer buried inside the section about what was cleaned
  await expect(page.getByRole("button", { name: /שליחת הסשן אלינו/ })).toBeVisible();
});

test("the bottom bar never covers the document", async ({ page }) => {
  await toCheckScreen(page);
  const gap = await page.evaluate(() => {
    const bar = document.querySelector("[data-bar]");
    const main = document.querySelector("[data-work]");
    if (!bar || !main) return null;
    const measured = getComputedStyle(document.documentElement).getPropertyValue("--bar-h").trim();
    return { measured, barH: bar.offsetHeight, padding: parseFloat(getComputedStyle(main).paddingBottom) };
  });
  expect(gap).not.toBeNull();
  // the reserved space comes from the bar's real height, not from a guess
  expect(gap.measured).toBe(gap.barH + "px");
  expect(gap.padding).toBeGreaterThanOrEqual(gap.barH);
});

test("the bar re-measures when it wraps on a narrow screen", async ({ page }) => {
  await toCheckScreen(page);
  const wide = await page.evaluate(() => document.querySelector("[data-bar]").offsetHeight);
  await page.setViewportSize({ width: 420, height: 780 });
  await expect.poll(async () => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bar-h").trim()
  )).toBe(await page.evaluate(() => document.querySelector("[data-bar]").offsetHeight + "px"));
  const narrow = await page.evaluate(() => document.querySelector("[data-bar]").offsetHeight);
  expect(narrow).toBeGreaterThanOrEqual(wide);
});
