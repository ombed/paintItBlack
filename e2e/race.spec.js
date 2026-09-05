const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Port of tests/race_t.js, which drove the vanilla UI through jsdom and
   cannot run against this build. The intent is unchanged: a scan that is
   still running must never let the user act on a partial name list, and a
   document abandoned mid-scan must never leak a name into the next one.
   That second case is a privacy failure in the wrong direction, a name
   from one client's file appearing in another's, which is why this is the
   first of the four UI suites to come across. The model is stubbed; the
   generation guard under test is the real code. */

test.beforeEach(async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
});

test("acting during a scan does nothing, and the scan result still lands", async ({ page }) => {
  await page.evaluate(() => {
    window.__ner = { delay: () => 1500, names: () => ["ברקוביץ"] };
  });
  await H.upload(page, "one.docx", "רונית לוי הגישה בקשה.");
  await H.startScan(page);

  // While the model runs, the primary button relabels itself and both
  // actions are locked. A locked button must be disabled, not merely
  // guarded in its handler: a guard alone leaves a control that looks live
  // and silently eats the click.
  await expect(H.scanning(page)).toBeVisible();
  await expect(H.scanning(page)).toBeDisabled();
  await expect(H.skipButton(page)).toBeDisabled();

  // Hammer it anyway. The handler path must not advance to places.
  await H.scanning(page).evaluate((el) => el.click());
  await H.skipButton(page).evaluate((el) => el.click());
  await expect(page.getByRole("heading", { name: /מי מופיע בתיק/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /יישובים/ })).toHaveCount(0);

  // Then the scan finishes, the lock lifts, and its result is in the list.
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(H.goButton(page)).toBeEnabled();
  await expect(H.skipButton(page)).toBeEnabled();
  expect(await H.listedNames(page)).toContain("ברקוביץ");
});

test("a document uploaded mid-scan never receives names from the one it replaced", async ({ page }) => {
  await page.evaluate(() => {
    window.__ner = {
      delay: (t) => (t.includes("ראשון") ? 1500 : 50),
      names: (t) => [t.includes("ראשון") ? "מהראשון" : "מהשני"],
    };
  });

  await H.upload(page, "first.docx", "מסמך ראשון");
  await H.startScan(page);
  await expect(H.scanning(page)).toBeVisible();

  // Abandon it: back to the file step, replace the document, scan again.
  await page.getByRole("button", { name: "קובץ", exact: true }).click();
  await H.upload(page, "second.docx", "מסמך שני");
  await H.startScan(page);

  // Let the second scan finish, then wait out the first one's late return.
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);

  const names = await H.listedNames(page);
  expect(names).toContain("מהשני");
  expect(names).not.toContain("מהראשון");
  expect(await page.evaluate(() => window.__nerCalls)).toBe(2);
});
