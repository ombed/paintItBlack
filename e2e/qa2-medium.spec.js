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
