const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* On a slow line the first model download takes minutes while the names
   from the header are already on screen. She can continue without waiting.

   This test used to assert that a late model result "must not land
   anywhere", and the tool obliged: continuing bumped the scan counter and the
   result was discarded whole. On a real case file that is exactly how a
   teacher's name, found seven times at full confidence, left the tool. A late
   result now lands in the rules and the document is processed again. The
   session log records it all, with counts and never text. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nברקוביץ העיד שראה את ברקוביץ ליד הבית.\nהדיון התקיים ביום שלישי.";

test("continuing without the model keeps the header names, and a late model result is still applied", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { delay: () => 8000, names: () => ["ברקוביץ"] }; });
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.scanning(page)).toBeVisible();
  expect(await H.listedNames(page)).toContain("רונית לוי");
  const goNow = page.getByRole("button", { name: /להמשיך בלי לחכות למודל/ });
  await expect(goNow).toBeVisible();
  await goNow.click();
  // straight on to the places screen; the late model result must not land anywhere
  await expect(page.getByRole("heading", { name: /יישובים/ })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(9000);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-work] section").first()).not.toContainText("רונית לוי");
  // the late result landed: the name it found is replaced in the document,
  // even though she never saw it on the people screen
  await expect(page.locator('[data-mark][data-val="ברקוביץ"]').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator("[data-work] section").first()).not.toContainText("ברקוביץ");

  // the session log
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await page.getByRole("button", { name: "העתקת יומן הסשן" }).click();
  const log = JSON.parse(await page.evaluate(() => window.__copied || "{}"));
  const evs = log.events.map((e) => e.ev);
  expect(evs).toContain("screen");
  expect(evs).toContain("go-without-model");
  expect(evs).toContain("run");
  expect(/[֐-׿]{3,}/.test(JSON.stringify(log))).toBe(false);
});
