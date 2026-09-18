const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Second QA audit (qa-audit/run-2): the Medium and Low items. One test per
   item that has a user-visible outcome. */

const sheet = (page) => page.locator("[data-work] section").first();

async function toWork(page, doc, names) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of names || []) { await input.fill(n); await input.press("Enter"); }
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}
const DOC = ["פרוטוקול", "מרים לוין: אני מבקשת לפתוח. הפגישה נקבעה ל-14.3.2026.", "מרים לוין: למרים יש טענות. ת.ז. 034567891."].join("\n");

test("M1: a case name typed during the tour does not follow the next real document", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("שמירה");
  await page.getByPlaceholder(/שם התיק/).fill("תיק-מהסיור");
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await tour.getByRole("button", { name: "סיום" }).click();
  await expect(tour).toHaveCount(0);
  // a real document now
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-case-field] input")).toHaveValue("");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
  const cases = await page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}"));
  expect(Object.keys(cases)).not.toContain("תיק-מהסיור");
});

test("M2: model findings of the previous document are not pending on the next one", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // the model finds a person in document A only
  // found twice, so the guard treats it as a real find; she takes it off the list in document A
  await page.evaluate(() => { window.__ner = { names: (t) => (t.includes("אלפא") ? ["גדי פרץ"] : []), n: () => 2 }; });
  await H.upload(page, "alpha.docx", ["מסמך אלפא", "שירה ברקוביץ: פתחתי.", "שירה ברקוביץ: גדי פרץ הגיע. גדי פרץ ישב."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 30000 });
  await expect.poll(() => H.listedNames(page), { timeout: 15000 }).toContain("גדי פרץ");
  await H.peopleRows(page).filter({ hasText: "גדי פרץ" }).first().getByRole("button", { name: "הסרה" }).click();
  await H.goOn(page);
  let run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  // a different client's document, model off
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "beta.docx", ["מסמך בטא", "דוד כהן: פתחתי.", "דוד כהן: סיימתי."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("[data-bar]")).not.toContainText("גדי פרץ");
  await expect(page.locator("[data-work]")).not.toContainText("גדי פרץ");
});
