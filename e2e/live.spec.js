const { test, expect } = require("./base");
const H = require("./helpers");

/* A result that appears is said (the independent review of 6.10). The file's card on the entry screen
   appeared with nothing said: a screen reader heard neither the name nor the size of what was loaded.
   The same class across the tool: a result, a question or an error that shows up with no live region,
   or inside a region that appears together with its text (often not announced at all), or that comes
   back in the same words, which a region that does not change never says. e2e/restore.spec.js covers the
   restore screen; e2e/a11y.spec.js (M28) the notice. */

const DOC = ["פרוטוקול דיון", "רחל פרידמן: אני מבקשת לפתוח.", "דוד כהן: אני המשיב.", "רחל פרידמן: תודה.", "דוד כהן: נסכם בכתב."].join("\n");
const OTHER = ["פרוטוקול ישיבה", "יעל ברגר: אני המבקשת.", "משה גולן: אני המשיב.", "יעל ברגר: תודה.", "משה גולן: נסכם."].join("\n");
// names in the prose that no heading or turn of speech puts on the list: «נמצאו גם» offers them (as e2e/ux-entry.spec.js)
const WITH_SUGGESTION = [
  "פרוטוקול דיון",
  "עו״ד רונן אלמליח פתח. מר יואב ברקוביץ׳ ענה.",
  "השופטת נועה קלדרון שאלה, ועו״ד רונן אלמליח השיב.",
  "מר יואב ברקוביץ׳ חזר על דבריו. השופטת נועה קלדרון סיכמה.",
].join("\n");

async function toPeople(page, text) {
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", text);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
async function toWork(page, text) {
  await toPeople(page, text);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(bar).toBeVisible({ timeout: 20000 });
}
const mark = (loc) => loc.evaluate((el) => { el.__said = true; });
const same = (loc) => loc.evaluate((el) => !!el.__said);

test("the loaded file is said: its card sits in a status region that is there before it", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const status = page.locator("main").getByRole("status");
  await expect(status, "the region is on the entry screen before a file is chosen").toHaveCount(1);
  await expect(status).toHaveText("");
  await H.upload(page, "case.docx", DOC);
  await expect(status.locator("[data-pend]")).toBeVisible();
  await expect(status).toContainText("case.docx");
  await expect(status).toContainText("5 פסקאות");
  // another file in its place, and pasted text: each is said in the same region
  await H.upload(page, "other.docx", OTHER);
  await expect(status).toContainText("other.docx");
  await page.getByPlaceholder("הדבקת טקסט לבדיקה…").fill(DOC);
  await page.getByRole("button", { name: "שימוש בטקסט הזה" }).click();
  await expect(status).toContainText("טקסט שהודבק");
  await expect(status).toContainText("טקסט מודבק");
});

test("the same rejected file, chosen twice, is said twice", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const bad = { name: "not-really.docx", mimeType: H.DOCX, buffer: Buffer.from("this is plain text, not a zip") };
  const input = page.locator('input[type="file"][accept*=".docx"]');
  await input.setInputFiles(bad);
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("Word");
  await mark(alert);
  await input.setInputFiles(bad);
  await expect(alert).toContainText("Word");
  await expect.poll(() => same(alert), { message: "the same error is put back as a new alert" }).toBe(false);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

  test("the question about downloading the model is said, in the file card's region", async ({ page }) => {
    await page.addInitScript(() => { window.__ner = { cached: false, names: () => [] }; });
    await H.serveEngineWithStub(page);
    await H.boot(page);
    await H.upload(page, "case.docx", DOC);
    await H.startScan(page);
    const status = page.locator("main").getByRole("status");
    await expect(status.locator("[data-ner-ask]")).toBeVisible();
    await expect(status).toContainText("185MB");
  });
});

test("the people screen says what changes: its note is a status, the model's failure an alert", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { error: "network" }; });
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator("main").getByRole("alert")).toContainText("מודל הזיהוי לא נטען");

  // without the model: the note under the list, and what it says when a long paste is refused
  await page.locator("[data-back]").click();
  await page.getByRole("checkbox").first().uncheck();
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const status = page.locator("main").getByRole("status");
  await expect(status).toContainText("זוהו 2 שמות");
  const field = page.getByPlaceholder(/^שם מלא — למשל/);
  await field.fill("אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר");
  await field.press("Enter");
  await expect(status).toContainText("קטע ארוך לא נוסף");
});

test("names left without a decision are said when «המשך» stops for them", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await toPeople(page, WITH_SUGGESTION);
  await H.goButton(page).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("בלי החלטה");
});

test("an error in the work bar is said: it is an alert", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await toWork(page, DOC);
  // the browser refuses both ways of copying
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error("blocked")); document.execCommand = () => false; });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI/ }).click();
  const anyway = page.getByRole("button", { name: /בכל זאת/ });
  if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
  await expect(page.locator("[data-bar]").getByRole("alert")).toContainText("ההעתקה נחסמה");
});

test("the tour's nudge is said, inside the card's live region", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" }); // the tour's sample document is not hers
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const live = page.locator('[data-tour] [aria-live="polite"]');
  await expect(live).toContainText("קובץ או טקסט");
  // a click outside the lit area is stopped, and the card says so (the keyboard never gets there since v69:
  // e2e/tour-hold.spec.js)
  await page.getByRole("button", { name: "מצב יום או לילה" }).click({ force: true });
  await expect(live.locator("[data-tour-nudge]")).toBeVisible();
});
