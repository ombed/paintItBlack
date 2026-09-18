const { test, expect } = require("./base");
const H = require("./helpers");

/* Release 4, wave 1: the entry and people screens (qa-audit/ux-1, run-1).

   Each test asserts what the user gets: where the button is, what the list
   holds, what the next document starts with. */

const DOC = [
  "פרוטוקול דיון",
  "עו״ד רונן אלמליח פתח. מר יואב ברקוביץ׳ ענה.",
  "השופטת נועה קלדרון שאלה, ועו״ד רונן אלמליח השיב.",
  "מר יואב ברקוביץ׳ חזר על דבריו. השופטת נועה קלדרון סיכמה.",
].join("\n");

async function toPeople(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
// the places screen always follows the people screen; its button leads to the check screen
async function toWork(page) {
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run).toBeVisible({ timeout: 15000 });
  await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
const sugChips = (page) => page.locator("button").filter({ hasText: /^\+ / });

test("UX #1: at 375 px the chosen-file row wraps, and the main button is fully on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await H.upload(page, "hearing.docx", DOC);
  const go = page.getByRole("button", { name: /המשך — איתור שמות/ });
  await expect(go).toBeVisible();
  const box = await go.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("UX #3: settings sit behind a toggle, closed on a phone; the profile card has a control", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  await expect(toggle).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "ייבוא פרופיל מקובץ" })).toBeVisible();
});

test("UX #4 / QA 010: a file that is not a Word document is rejected at once, next to the file card", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
    name: "not-really.docx", mimeType: H.DOCX, buffer: Buffer.from("this is plain text, not a zip"),
  });
  const err = page.locator("[data-file-err]");
  await expect(err).toBeVisible();
  await expect(err).toContainText("Word");
  // no green ✓ row and no way to continue with it
  await expect(page.getByRole("button", { name: /המשך — איתור שמות/ })).toHaveCount(0);
});

test("QA 010: an empty Word document is rejected at once", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const bytes = await page.evaluate(async () => {
    const mod = await import("./text-to-docx.js");
    return Array.from(new Uint8Array(await mod.textToDocx(" ")));
  });
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: "empty.docx", mimeType: H.DOCX, buffer: Buffer.from(bytes) });
  await expect(page.locator("[data-file-err]")).toContainText("אין טקסט");
  await expect(page.getByRole("button", { name: /המשך — איתור שמות/ })).toHaveCount(0);
});

test("UX #5: a disabled button looks disabled", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { delay: () => 4000 }; });
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  const busy = H.scanning(page);
  await expect(busy).toBeDisabled();
  const opacity = await busy.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(opacity).toBeLessThan(0.7);
});

test("UX #7: 'לא לחכות למודל' stays on the list and enables 'המשך'", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { delay: () => 8000 }; });
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await page.getByRole("button", { name: "לא לחכות למודל" }).click();
  await expect(page.getByRole("heading", { name: "מי מופיע בתיק" })).toBeVisible();
  await expect(H.goButton(page)).toBeEnabled();
  await expect(sugChips(page).first()).toBeVisible();
});

test("UX #8: 'הוספת כולם' adds every suggestion, and 'המשך' with open ones asks first", async ({ page }) => {
  await toPeople(page);
  const open = await sugChips(page).count();
  expect(open).toBeGreaterThan(0);
  // "המשך" with open suggestions: an inline question, and we are still on the list
  await H.goButton(page).click();
  const ask = page.locator("[data-sug-prompt]");
  await expect(ask).toBeVisible();
  await expect(ask).toContainText(String(open === 1 ? "שם אחד" : open));
  await expect(page.getByRole("heading", { name: "מי מופיע בתיק" })).toBeVisible();
  // add all from the question, and go on
  await ask.getByRole("button", { name: "הוספת כולם והמשך" }).click();
  await toWork(page);
  const text = await page.locator("[data-work] section").first().innerText();
  for (const n of ["אלמליח", "ברקוביץ", "קלדרון"]) expect(text).not.toContain(n);
});

test("UX #8: the strip's own 'הוספת כולם' empties it and fills the list", async ({ page }) => {
  await toPeople(page);
  const values = (await sugChips(page).allTextContents()).map((t) => t.replace(/^\+\s*/, "").trim());
  expect(values.length).toBeGreaterThan(1);
  await page.locator("[data-add-all]").click();
  await expect(sugChips(page)).toHaveCount(0);
  const names = await H.listedNames(page);
  for (const v of values) expect(names).toContain(v);
});

test("UX #16 / #21: the case name is on the people screen, and an attached case shows everywhere", async ({ page }) => {
  await toPeople(page);
  const field = page.locator("[data-case-field] input");
  await expect(field).toBeVisible();
  await field.fill("אלמליח נ׳ קלדרון");
  await page.locator("[data-add-all]").click();
  await H.goOn(page);
  await toWork(page);
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")))).toContain("אלמליח נ׳ קלדרון");

  // next document: the case row says what it does, and after the click the case is shown
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await H.upload(page, "second.docx", DOC);
  await page.getByRole("button", { name: "שימוש בתיק הזה" }).click();
  const chip = page.locator("[data-case-chip]");
  await expect(chip).toContainText("תיק: אלמליח נ׳ קלדרון");
  await H.startScan(page);
  await expect(chip).toContainText("אלמליח נ׳ קלדרון");
  await page.getByRole("button", { name: /החזרת שמות מתשובת AI/ }).click();
  await expect(page.locator("main")).toContainText("תיק: אלמליח נ׳ קלדרון");
});

test("QA 012: the ✕ on the recent-cases strip hides it without deleting anything", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.addInitScript(() => {
    const prof = { v: 1, name: "תיק בדיקה", created: new Date().toISOString(), updated: new Date().toISOString(), mode: "real",
      rules: [{ value: "רונן אלמליח", kind: "NAME", replacement: "דני כהן" }], allow: [], map: { "רונן אלמליח": "דני כהן" } };
    try { localStorage.setItem("redact-cases", JSON.stringify({ "תיק בדיקה": prof })); } catch (_) {}
  });
  await H.boot(page);
  await H.upload(page, "hearing.docx", DOC);
  let asked = false;
  page.on("dialog", (d) => { asked = true; d.dismiss(); });
  await page.getByRole("button", { name: "הסתרת התיקים האחרונים" }).click();
  await expect(page.getByText("תיקים אחרונים")).toHaveCount(0);
  expect(asked).toBe(false);
  const kept = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")));
  expect(kept).toContain("תיק בדיקה");
});

test("UX #22 / QA 005: 'מסמך חדש' starts clean: top of page, no old file, no stale text or filters", async ({ page }) => {
  await toPeople(page);
  await H.goOn(page);
  await toWork(page);
  await page.getByPlaceholder("חיפוש בממצאים").fill("זזז");
  await page.getByPlaceholder("ערך שפוספס").fill("ססס");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await expect(page.getByRole("heading", { name: /מה יוצא מהמסמך/ })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByText("hearing.docx")).toHaveCount(0);
  expect(await page.getByPlaceholder("הדבקת טקסט לבדיקה…").inputValue()).toBe("");

  // the next document opens with an unfiltered rail
  await page.getByPlaceholder("הדבקת טקסט לבדיקה…").fill("סיכום שיחה\nמר אבי לוינסון התקשר. אבי לוינסון ביקש לדחות.");
  await page.getByRole("button", { name: "שימוש בטקסט הזה" }).click();
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("אבי לוינסון"); await input.press("Enter");
  await H.goOn(page);
  await toWork(page);
  expect(await page.getByPlaceholder("חיפוש בממצאים").inputValue()).toBe("");
  expect(await page.getByPlaceholder("ערך שפוספס").inputValue()).toBe("");
  await expect(page.getByText("אין ממצאים בקטגוריה הזאת")).toHaveCount(0);
  await expect(page.locator("[data-group]").first()).toBeVisible();
  const text = await page.locator("[data-work] section").first().innerText();
  expect(text).not.toContain("אלמליח");
});
