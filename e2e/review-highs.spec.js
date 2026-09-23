const { test, expect } = require("./base");
const H = require("./helpers");

/* Findings of the outside review of 2026-09-20 that she would meet on the check screen. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

async function toCheck(page, doc) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
}

/* H3: a brace-less else let the redacted sheet overwrite the original one, so «מקור» lit up
   and went on showing pseudonyms. Realistic Hebrew pseudonyms made that impossible to notice. */
test("«מקור» shows the original text, and «מושחר» brings the redacted text back", async ({ page }) => {
  await toCheck(page, DOC);
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).not.toContainText("רונית לוי");
  const redacted = await sheet.innerText();

  await page.getByRole("button", { name: "מקור", exact: true }).click();
  await expect(sheet).toContainText("רונית לוי הגישה בקשה לצו הגנה.");
  const lines = (await sheet.innerText()).split("\n").map((x) => x.trim()).filter(Boolean);
  for (const p of DOC.split("\n")) expect(lines).toContain(p);
  await expect(sheet.locator("[data-mark]")).toHaveCount(0);

  await page.getByRole("button", { name: "מושחר", exact: true }).click();
  await expect(sheet).not.toContainText("רונית לוי");
  expect(await sheet.innerText()).toBe(redacted);
});

/* H2: the red bar said "do not send, do not copy" and the download went out without a
   question, because the guard counted open items and never looked at the verification. The
   name here survives in a part the final check reads and the pipeline does not rewrite. */
test("a failed verification stops the download until she says so", async ({ page }) => {
  const { mkzip } = require("../tests/mkzip.js");
  const L = require("../tests/structure-lib.js");
  const NAME = L.NAME;
  // numbering.xml was this part until the pipeline learnt to clear list text, and every XML part
  // it does not walk is now cleared by a last pass (the rest of H10). An embedded object, written
  // as UTF-16 the way Word's OLE streams are, is read by the final check and cleaned by nothing.
  const ole = Buffer.from("OLE " + NAME + " END", "utf16le");
  const file = Buffer.from(new Uint8Array(mkzip([...L.base,
    { name: "word/document.xml", body: L.doc(L.P(L.R(`${NAME}: אני מבקשת לפתוח.`)) + L.P(L.R("אבנר שטרן: בבקשה.")) + L.P(L.R(`${NAME}: תודה.`)) + L.P(L.R("אבנר שטרן: נכון."))) },
    { name: "word/embeddings/oleObject1.bin", body: ole }])));
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: "case.docx", mimeType: H.DOCX, buffer: file });
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-bar-text]").first()).toContainText("האימות נכשל");

  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.getByRole("button", { name: /הורדת Word/ }).click();
  const ask = page.getByRole("alert").filter({ hasText: "האימות נכשל" });
  await expect(ask).toBeVisible();
  await page.waitForTimeout(800);
  expect(downloads).toBe(0);
  // she can still take the file, knowingly
  const got = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: "להוריד בכל זאת" }).click();
  await got;
  expect(downloads).toBe(1);
});

/* H11, and the decision of 20.9: removing a name from the list is remembered by the case. It
   used to be forgotten: the next document of the case brought the rule back without a word,
   with its old pseudonym, while "לא שם" was remembered. A removed name that turns up again
   is put in front of her as a suggestion, never added and never skipped in silence. */
test("a name removed from the list stays removed in the next document of the case, and comes back only as a question", async ({ page }) => {
  const A = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");
  const B = ["המשך הדיון", "רחל פרידמן: חזרתי.", "אבנר שטרן: גם אני.", "רחל פרידמן: נתחיל.", "אבנר שטרן: בבקשה."].join("\n");
  const toWork = async () => {
    const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
    await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
    if (await run.isVisible()) await run.click();
    await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  };
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "first.docx", A);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.locator("[data-case-field] input").fill("פרידמן נ׳ שטרן");
  await H.goOn(page);
  await toWork();
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).not.toContainText("אבנר שטרן");

  // she removes him from the list, in the profile section of the rail
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.locator("[data-mine] > div").filter({ hasText: "אבנר שטרן" }).getByRole("button", { name: "הסרה מהרשימה" }).click();
  await expect.poll(() => sheet.innerText(), { timeout: 15000 }).toContain("אבנר שטרן");
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("redact-cases") || "{}")["פרידמן נ׳ שטרן"] || {}).removed || [])).toContain("אבנר שטרן");

  // the next document of the same case
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await H.upload(page, "second.docx", B);
  await page.getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const names = await H.listedNames(page);
  expect(names).toContain("רחל פרידמן");
  expect(names).not.toContain("אבנר שטרן");
  // not silently skipped: he is offered, first, with the reason
  const offer = page.locator("button").filter({ hasText: /^\+ אבנר שטרן/ }).first();
  await expect(offer).toBeVisible();
  await expect(page.locator("[data-removed-note]")).toHaveText("הוסר במסמך קודם בתיק"); // visible, not a tooltip
  // declining keeps him in clear; the case still remembers
  await H.goOn(page);
  await toWork();
  await expect(sheet).toContainText("אבנר שטרן");
  await expect(sheet).not.toContainText("רחל פרידמן");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}")["פרידמן נ׳ שטרן"]);
  expect(stored.removed).toContain("אבנר שטרן");
  expect(stored.rules.map((r) => r.value)).not.toContain("אבנר שטרן");
  expect(Object.keys(stored.map || {})).not.toContain("אבנר שטרן");
});

test("accepting the question puts the name back, and the case forgets the removal", async ({ page }) => {
  const prof = { v: 1, name: "תיק בדיקה", created: new Date().toISOString(), updated: new Date().toISOString(), mode: "real",
    rules: [{ value: "רחל פרידמן", kind: "NAME", replacement: "יעל כהן" }], allow: [], map: { "רחל פרידמן": "יעל כהן" }, removed: ["אבנר שטרן"] };
  await H.serveEngineWithStub(page);
  await page.addInitScript((p) => { try { localStorage.setItem("redact-cases", JSON.stringify({ [p.name]: p })); } catch (_) {} }, prof);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "second.docx", ["המשך הדיון", "רחל פרידמן: חזרתי.", "אבנר שטרן: גם אני.", "רחל פרידמן: נתחיל.", "אבנר שטרן: בבקשה."].join("\n"));
  await page.getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.locator("button").filter({ hasText: /^\+ אבנר שטרן/ }).first().click();
  expect(await H.listedNames(page)).toContain("אבנר שטרן");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-work] section").first()).not.toContainText("אבנר שטרן");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}")["תיק בדיקה"].removed || [])).not.toContain("אבנר שטרן");
});

test("removing the last rule is saved too: the case does not keep a list she emptied", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "one.docx", ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "הדיון נדחה.", "רחל פרידמן: תודה."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.locator("[data-case-field] input").fill("תיק של אחת");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}")["תיק של אחת"]);
  await expect.poll(async () => ((await stored()) || { rules: [] }).rules.map((r) => r.value)).toContain("רחל פרידמן");
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.locator("[data-mine] > div").filter({ hasText: "רחל פרידמן" }).getByRole("button", { name: "הסרה מהרשימה" }).click();
  await expect.poll(async () => (await stored()).rules.map((r) => r.value)).not.toContain("רחל פרידמן");
  expect((await stored()).removed).toEqual(["רחל פרידמן"]);
});

/* H8: «אל תחליף» on a place, in the second document of a case. The rule arrives from the case
   profile, the button added the allowance and left the rule, and the allowance knew fewer prefix
   forms than the rule: "בחיפה" stayed and "שבחיפה" was replaced in the same document. */
test("«אל תחליף» on a place holds for every prefix form, also when the case already had a rule for it", async ({ page }) => {
  const prof = { v: 1, name: "תיק מקומות", created: new Date().toISOString(), updated: new Date().toISOString(), mode: "real",
    rules: [{ value: "חיפה", kind: "PLACE", replacement: "אשדוד", auto: false }], allow: [], map: { "חיפה": "אשדוד" } };
  await H.serveEngineWithStub(page);
  await page.addInitScript((p) => { try { localStorage.setItem("redact-cases", JSON.stringify({ [p.name]: p })); } catch (_) {} }, prof);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "second.docx", ["סיכום ביקור", "המשפחה מתגוררת בחיפה מזה שש שנים, ועברה לשם מתל אביב.", "העובדת הסוציאלית ציינה שבחיפה אין מעון מתאים, ושהחיפוש נמשך גם בירושלים."].join("\n"));
  await page.getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await H.startScan(page);
  await expect(H.goButton(page).or(H.skipButton(page)).first()).toBeVisible({ timeout: 10000 });
  if (await H.goButton(page).isVisible()) await H.goOn(page); else await H.skipButton(page).click();
  const row = page.locator('div:has(> button:text-is("אל תחליף"))').filter({ hasText: "חיפה" }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: "אל תחליף" }).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד/ }).first();
  await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  const text = await page.locator("[data-work] section").first().innerText();
  expect(text).toContain("מתגוררת בחיפה");
  expect(text).toContain("ציינה שבחיפה");
  expect(text).not.toContain("אשדוד");
  const held = await page.evaluate(() => { const s = window.__pib.state(); return { rule: s.rules.some((r) => r.value === "חיפה"), allow: s.allow.includes("חיפה") }; });
  expect(held).toEqual({ rule: false, allow: true });
});

/* M3: a model that fails after she chose not to wait. The failure message lived on the people
   screen only, and the check screen did not mention the model at all. */
test("a model that fails after she moved on says so on the screen she is on", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { delay: () => 6000, error: "הרשת נפלה" }; });
  await H.upload(page, "case.docx", "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.");
  await H.startScan(page);
  await expect(H.scanning(page)).toBeVisible();
  await page.getByRole("button", { name: /לא לחכות למודל/ }).click();
  await expect(H.goButton(page)).toBeEnabled();
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  const notice = page.locator("[data-notice]");
  await expect(notice).toBeVisible({ timeout: 15000 });
  await expect(notice).toContainText("מודל הזיהוי לא נטען");
});

/* M1: deleting a case cleared the case list and left the same real-name map in
   "redact-profile-last", in plain text, and an open document re-created the case on its next save. */
test("deleting a case deletes its names too", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "one.docx", ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.locator("[data-case-field] input").fill("תיק למחיקה");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  const store = () => page.evaluate(() => ({ cases: Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")), last: localStorage.getItem("redact-profile-last") || "" }));
  await expect.poll(async () => (await store()).cases).toContain("תיק למחיקה");
  expect((await store()).last).toContain("רחל פרידמן");

  // back to the entry screen, where the case is listed, and delete it there
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  const strip = page.locator("main").filter({ hasText: "תיק למחיקה" });
  await expect(strip).toBeVisible();
  await page.locator('button[title^="מחיקה מרשימת התיקים"]').first().click();
  const after = await store();
  expect(after.cases).not.toContain("תיק למחיקה");
  expect(after.last).not.toContain("רחל פרידמן");
  expect(after.last).not.toContain("אבנר שטרן");
  await expect(page.getByText("תיק למחיקה")).toHaveCount(0);
});
