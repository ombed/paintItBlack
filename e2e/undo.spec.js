const { test, expect } = require("./base");
const H = require("./helpers");

/* A name the list got wrong is the commonest mistake she has to fix, and
   the fix used to hide until the card was clicked, behind a button that
   only excused the text and left the rule in the list. The applied card now
   carries the two undos in plain sight. Model off, the header anchor fills
   the list, so what is replaced came from the list alone. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

test.beforeEach(async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
});

const doc = (page) => page.locator("[data-work] section").first();

test("the applied card removes a wrong name from the list without a click first, and the text comes back", async ({ page }) => {
  await expect(doc(page)).not.toContainText("רונית לוי");
  // the findings section is open on arrival and the undo is visible on the card, unselected
  const card = page.locator("[data-group]").filter({ hasText: "רונית לוי" }).first();
  const undo = card.getByRole("button", { name: "לא שם — הסרה מהרשימה" });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(doc(page)).toContainText("רונית לוי הגישה בקשה");
  await expect(page.locator("[data-group]").filter({ hasText: "רונית לוי" })).toHaveCount(0);
});

test("two rail sections stay open together", async ({ page }) => {
  const profile = page.getByRole("button", { name: /הרשימה ופרופיל התיק/ });
  await profile.click();
  await expect(page.getByPlaceholder("ערך שפוספס")).toBeVisible();
  // the findings list did not collapse when the profile opened
  await expect(page.locator("[data-group]").first()).toBeVisible();
});

/* Review L7: bringing back a name she had told to stay, and loading a case over the document,
   changed the list without a step in the history, so undo jumped over them. */
test("bringing a kept name back to replacement is one undo step", async ({ page }) => {
  const card = page.locator("[data-group]").filter({ hasText: "רונית לוי" }).first();
  await card.getByRole("button", { name: "אל תחליף" }).click();
  await expect(doc(page)).toContainText("רונית לוי הגישה בקשה");
  await page.getByRole("button", { name: /רונית לוי ↩/ }).click();
  await expect(doc(page)).not.toContainText("רונית לוי");
  await page.getByRole("button", { name: "ביטול הפעולה האחרונה" }).click();
  // one step back is the state before the restore: kept, so the real name is in the text again
  await expect(doc(page)).toContainText("רונית לוי הגישה בקשה");
});

test("loading a case over the document in progress is one undo step", async ({ page }) => {
  const before = await page.evaluate(() => window.__pib.state().rules.map((r) => r.value).sort());
  const prof = { v: 1, name: "", mode: "real", rules: [{ value: "יוסי כהן", kind: "NAME", replacement: "דני לוי", auto: true }], allow: ["רונית לוי"], removed: [], map: {} };
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: "case.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(prof)) });
  await expect.poll(() => page.evaluate(() => window.__pib.state().rules.map((r) => r.value))).toContain("יוסי כהן");
  await page.getByRole("button", { name: "ביטול הפעולה האחרונה" }).click();
  await expect.poll(() => page.evaluate(() => window.__pib.state().rules.map((r) => r.value).sort())).toEqual(before);
});
