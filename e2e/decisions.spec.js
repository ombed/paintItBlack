const { test, expect } = require("./base");
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
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  // not replaced, and not offered again anywhere in the rail
  await expect(page.locator("[data-work] section").first()).toContainText("ברקוביץ");
  // another prose name may still be offered; this one must not be
  // (review H5: this read /ברקוביץ d+×/, a literal "d", which can match nothing and so could never fail)
  await expect(page.locator("aside")).not.toContainText(/ברקוביץ \d+×/); // as an item; context snippets may still quote it
  // and the decision itself is recorded: not a rule, and on the "do not replace" list. The old
  // check looked for the words "אל תחליף" in the panel, which is a button label that is always there.
  const held = await page.evaluate(() => { const s = window.__pib.state(); return { rule: s.rules.some((r) => r.value === "ברקוביץ"), allow: s.allow.includes("ברקוביץ") }; });
  expect(held).toEqual({ rule: false, allow: true });
  // and she can see it: the "staying as they are" strip names it, with the way back
  await expect(page.locator('button[title="לחזור ולהחליף"]').filter({ hasText: "ברקוביץ" })).toBeVisible();
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
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
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
