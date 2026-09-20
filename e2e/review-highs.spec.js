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
  const numbering = `<?xml version="1.0"?><w:numbering ${L.WNS}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:lvlText w:val="${NAME}"/></w:lvl></w:abstractNum></w:numbering>`;
  const file = Buffer.from(new Uint8Array(mkzip([...L.base,
    { name: "word/document.xml", body: L.doc(L.P(L.R(`${NAME}: אני מבקשת לפתוח.`)) + L.P(L.R("אבנר שטרן: בבקשה.")) + L.P(L.R(`${NAME}: תודה.`)) + L.P(L.R("אבנר שטרן: נכון."))) },
    { name: "word/numbering.xml", body: numbering }])));
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
