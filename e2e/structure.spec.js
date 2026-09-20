const { test, expect } = require("./base");
const H = require("./helpers");
const { mkzip } = require("../tests/mkzip.js");
const L = require("../tests/structure-lib.js");

/* Review C2. The app read the document with its own reader, which knew fewer parts than
   the redaction did, so a name that lived only in a chart label reached neither the model
   nor the list, stayed in the downloaded file, and the bar went green. Both now use one
   reader in the engine. */

const NAME = L.NAME;
const chart = `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:ser><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>${NAME}</c:v></c:pt></c:strCache></c:strRef></c:cat></c:ser></c:chart></c:chartSpace>`;
const file = () => Buffer.from(new Uint8Array(mkzip([...L.base,
  { name: "word/document.xml", body: L.doc(L.P(L.R("המסמך עוסק בהסדרי ראייה ובמזונות.")) + L.P(L.R("הדיון נדחה לחודש הבא."))) },
  { name: "word/charts/chart1.xml", body: chart }])));

async function load(page) {
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: "chart.docx", mimeType: H.DOCX, buffer: file() });
  await expect(page.getByText("chart.docx")).toBeVisible();
  await H.startScan(page);
}
async function toCheck(page) {
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("with the model, a name that lives only in a chart label reaches the list and is replaced", async ({ page }) => {
  await H.serveEngineWithStub(page);
  // the stub answers from the text it is handed, so the name is found only if the chart was read
  await page.addInitScript(() => { window.__ner = { names: (t) => (t.includes("רחל פרידמן") ? ["רחל פרידמן"] : []), cached: true }; });
  await H.boot(page);
  await load(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
  expect(await H.listedNames(page)).toContain(NAME);
  await H.goOn(page);
  await toCheck(page);
  await expect(page.locator(`[data-mark][data-val="${NAME}"]`).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-work] section").first()).not.toContainText(NAME);
});

test("without the model, the chart label is put in front of her and the status is not all-clear", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await load(page);
  await expect(H.goButton(page).or(H.skipButton(page)).first()).toBeVisible({ timeout: 15000 });
  if (await H.goButton(page).isVisible()) await H.goOn(page); else await H.skipButton(page).click();
  await toCheck(page);
  // the name is still in the text, and she is asked about it
  await expect(page.locator("[data-work]")).toContainText("תווית בגרף או בתרשים");
  const state = await page.evaluate(() => { const v = window.__pib.state().res.verification; return { suggest: v.suggest.map((x) => x.value), complete: v.complete }; });
  expect(state.suggest).toContain(NAME);
  expect(state.complete).toBe(false);
  // the real all-clear wording, from the UX #15 check: it must not be showing
  await expect(page.locator("[data-bar-text]").first()).not.toContainText("לא נשארו בטקסט שמות או מספרים מהרשימה");
  await expect(page.locator("[data-bar-text]").first()).toContainText(/ממתינ|להחלטה|לבדיקה/);
});
