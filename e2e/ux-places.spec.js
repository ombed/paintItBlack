const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Release 4, wave 3: places, restore, profile export and the model download
   (qa-audit/ux-1 #6 #9 #10 #17 #19 #20). */

async function boot(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
}
async function toPeople(page, doc, names) {
  await boot(page);
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of names || []) { await input.fill(n); await input.press("Enter"); }
}
const sheet = (page) => page.locator("[data-work] section").first();

test("UX #9: with no distance map, the title and the first line say so", async ({ page }) => {
  await toPeople(page, ["סיכום", "מר דני כהן גר בנשר."].join("\n"), ["דני כהן"]);
  await H.goOn(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("יישובים שנמצאו", { timeout: 15000 });
  await expect(page.locator("[data-places-lead]")).toContainText("אין מפת מרחקים");
  // the explanation is behind "למה?"
  await expect(page.getByText("נסיעה של עשר דקות")).not.toBeVisible();
  await page.getByText("למה?").click();
  await expect(page.getByText(/נסיעה של עשר דקות/)).toBeVisible();
});

test("UX #9: with a map, the title promises the distances", async ({ page }) => {
  await toPeople(page, ["סיכום", "מר דני כהן גר בחיפה ועבד בנתניה."].join("\n"), ["דני כהן"]);
  await H.goOn(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/ששומרת על המרחקים/, { timeout: 15000 });
});

test("UX #10: a place already confirmed on the list shows as checked, and unchecking keeps it", async ({ page }) => {
  await toPeople(page, ["סיכום", "מר דני כהן גר בנשר. בנשר יש גן יפה."].join("\n"), ["דני כהן", "נשר"]);
  const row = H.peopleRows(page).filter({ hasText: "נשר" }).first();
  await row.getByRole("combobox").selectOption("PLACE");
  await H.goOn(page);
  const extra = page.locator("[data-wrap]").filter({ hasText: "נשר" }).first();
  await expect(extra).toBeVisible({ timeout: 15000 });
  const box = extra.getByRole("checkbox", { name: "להחליף" });
  await expect(box).toBeChecked();
  await expect(extra).toContainText("אושר ברשימה");
  // what the screen shows is what happens: unchecked means kept
  await box.uncheck();
  await page.getByRole("button", { name: "המשך לבדיקה" }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(sheet(page)).toContainText("בנשר");
});

test("UX #10: checked means replaced", async ({ page }) => {
  await toPeople(page, ["סיכום", "מר דני כהן גר בנשר. בנשר יש גן יפה."].join("\n"), ["דני כהן", "נשר"]);
  const row = H.peopleRows(page).filter({ hasText: "נשר" }).first();
  await row.getByRole("combobox").selectOption("PLACE");
  await H.goOn(page);
  const extra = page.locator("[data-wrap]").filter({ hasText: "נשר" }).first();
  await expect(extra.getByRole("checkbox", { name: "להחליף" })).toBeChecked({ timeout: 15000 });
  const to = await extra.locator('input[type="text"], input:not([type])').first().inputValue();
  await page.getByRole("button", { name: "המשך לבדיקה" }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const text = await sheet(page).innerText();
  expect(text).not.toContain("נשר");
  expect(text).toContain(to);
});

test("UX #17: the profile buttons say export and import, and export says where the file went", async ({ page }) => {
  await toPeople(page, ["סיכום", "מר דני כהן הגיע. דני כהן חייך."].join("\n"), ["דני כהן"]);
  await H.goOn(page);
  await page.getByRole("button", { name: /המשך לבדיקה|החלת הקבוצה/ }).first().click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await expect(page.getByRole("button", { name: "ייבוא מקובץ" })).toBeVisible();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא לקובץ" }).click();
  const name = (await d).suggestedFilename();
  expect(name).toMatch(/^פרופיל-.*\.json$/);
  await expect(page.locator("[data-notice]")).toContainText(name);
});

test("UX #19 / #20: restore is disabled while empty; the result has a heading with a count, and copy becomes primary", async ({ page }) => {
  await toPeople(page, ["סיכום", "מר יואב ברקוביץ׳ הגיע. יואב ברקוביץ׳ חייך."].join("\n"), ["יואב ברקוביץ'"]);
  await H.goOn(page);
  await page.getByRole("button", { name: /המשך לבדיקה|החלת הקבוצה/ }).first().click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const fake = (await page.locator("[data-mark]").first().textContent()).trim();
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  const go = page.getByRole("button", { name: "החזרת שמות", exact: true });
  await expect(go).toBeDisabled();
  await expect(page.getByText(/מדביקים כאן את מה שה-AI החזיר/)).toBeVisible();
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(`לדעתי ${fake} צודק, ו${fake} צריך להגיש.`);
  await expect(go).toBeEnabled();
  await go.click();
  const head = page.locator("[data-rv-result]");
  await expect(head).toContainText("התשובה עם השמות האמיתיים");
  await expect(head).toContainText("2 שמות הוחזרו");
  // the spelling that comes back is the document's, with the geresh
  await expect(page.locator("[data-rv-out]")).toContainText("יואב ברקוביץ׳ צודק");
  await expect(page.locator("[data-rv-out]")).not.toContainText("ברקוביץ'");
  // copy is now the primary action
  const copyBg = await page.getByRole("button", { name: /העתקת הטקסט המשוחזר/ }).evaluate((el) => getComputedStyle(el).backgroundColor);
  const goBg = await go.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(copyBg).not.toBe(goBg);
});

test("UX #6: a stalled model download says so, and 'לנסות שוב' starts a fresh load", async ({ page }) => {
  await H.serveEngineWithStub(page);
  // replace the stub with one that reports download progress and then goes quiet
  await page.route("**/redact-engine.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()) + `
nerRun = async () => {
  window.__loads = (window.__loads || 0) + 1;
  nerSay("מוריד את מודל הזיהוי: 10 מתוך 179 MB", 6);
  await new Promise((r) => setTimeout(r, 400));
  nerSay("מוריד את מודל הזיהוי: 20 מתוך 179 MB", 11);
  await new Promise(() => {});
};
`;
    await route.fulfill({ response: res, body, headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" } });
  });
  await page.clock.install();
  await H.boot(page);
  await H.upload(page, "case.docx", ["סיכום", "מר דני כהן הגיע."].join("\n"));
  await H.startScan(page);
  await expect(page.locator("[data-ner-msg]")).toContainText("מוריד את מודל הזיהוי", { timeout: 10000 });
  await page.clock.runFor(25000);
  const stall = page.locator("[data-ner-stall]");
  await expect(stall).toBeVisible();
  expect(await page.evaluate(() => window.__loads)).toBe(1);
  await stall.getByRole("button", { name: "לנסות שוב" }).click();
  await expect.poll(() => page.evaluate(() => window.__loads)).toBe(2);
  await expect(stall).toHaveCount(0);
  // and "לא לחכות למודל" is still the way out
  await expect(page.getByRole("button", { name: "לא לחכות למודל" })).toBeVisible();
});
