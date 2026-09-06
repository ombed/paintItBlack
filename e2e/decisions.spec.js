const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Two things she reported from a real file. A name she removed on the
   people screen came back at the check screen as a suggestion, because
   removal was not remembered as a decision. And the replacement arrows
   pointed sideways and jumped from wherever the cursor last was, not from
   the mark she had just clicked. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהשכן שמעוני אמר שהוא מסכים. הפסיכולוג ברקוביץ ציין כי המצב יציב.\nרונית לוי תעדכן. ברקוביץ יגיש חוות דעת.";

test("a found name removed on the people screen does not come back at the check screen", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { names: () => ["ברקוביץ"] }; });
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  expect(await H.listedNames(page)).toContain("ברקוביץ");
  await H.peopleRows(page).filter({ hasText: "ברקוביץ" }).getByRole("button", { name: "הסרה" }).click();
  expect(await H.listedNames(page)).not.toContain("ברקוביץ");
  await H.goButton(page).click();
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  // not replaced, and not offered again anywhere in the rail
  await expect(page.locator("[data-work] section").first()).toContainText("ברקוביץ");
  // another prose name may still be offered; this one must not be
  await expect(page.locator("aside")).not.toContainText(/ברקוביץ d+×/); // as an item; context snippets may still quote it
  // and the decision sits in the profile as "do not replace"
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await expect(page.locator("aside")).toContainText("אל תחליף");
});

test("the arrows say up and down, and next moves from the mark she clicked", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ }).first().click();
  const marks = page.locator("[data-mark]");
  await expect(marks.first()).toBeVisible({ timeout: 15000 });
  const n = await marks.count();
  expect(n).toBeGreaterThan(2);
  const prev = page.getByRole("button", { name: "החלפה קודמת" }), next = page.getByRole("button", { name: "החלפה הבאה" });
  await expect(prev).toHaveText("▲");
  await expect(next).toHaveText("▼");
  const counter = page.getByText(new RegExp("^\\d+ / " + n + "$"));
  await expect(counter).toHaveText("1 / " + n);
  // click the second mark, then next: the cursor continues from there
  await marks.nth(1).click();
  await expect(counter).toHaveText("2 / " + n);
  await next.click();
  await expect(counter).toHaveText("3 / " + n);
  await prev.click(); await prev.click();
  await expect(counter).toHaveText("1 / " + n);
});
