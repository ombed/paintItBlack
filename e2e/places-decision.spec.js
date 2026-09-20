const { test, expect } = require("./base");
const H = require("./helpers");

/* One place, one decision (found by the owner on 2026-09-20). Two parts of the app each decided
   what a town becomes. A town that already had a rule when the places screen opened, because she
   typed it on the first screen or because it came from a case, was skipped when the screen wrote
   its choices: the rule stayed empty, the engine picked for itself, and the document got a third
   town, neither the real one nor the one she chose. And a place she typed that the gazetteer does
   not know never appeared on the places screen at all, and was replaced by a name nobody saw.
   What the places screen shows is now what is written, for every place. */

const DOC = ["סיכום ביקור", "המשפחה מתגוררת בחיפה מזה שש שנים, ועברה לשם מתל אביב.", "הסבתא גרה בירושלים. הדוד גר בשכונת נווה צדק, ליד המרכז.", "רחל פרידמן: כך סיפרה האם.", "רחל פרידמן: תודה."].join("\n");

async function toPeople(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "visit.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
async function typePlace(page, v) {
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill(v); await input.press("Enter");
  await H.peopleRows(page).filter({ hasText: v }).getByRole("combobox").selectOption("PLACE");
}
const mapRow = (page, town) => page.locator('div:has(> button:text-is("אל תחליף"))').filter({ hasText: town }).first();
const applied = (page) => page.evaluate(() => Object.fromEntries(window.__pib.state().res.applied.map((r) => [r.base || r.value, r.baseRep || r.rep])));
async function toCheck(page) {
  await page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first().click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
}

test("a town she typed on the first screen gets the substitute she chose on the places screen", async ({ page }) => {
  await toPeople(page);
  await typePlace(page, "חיפה");
  await H.goOn(page);
  const row = mapRow(page, "חיפה");
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator("input").fill("נתניה");
  await toCheck(page);
  expect((await applied(page))["חיפה"]).toBe("נתניה");
  const text = await page.locator("[data-work] section").first().innerText();
  expect(text).toContain("מתגוררת בנתניה");
  expect(text).not.toContain("חיפה");
});

test("with no edit, the document gets exactly what the places screen showed, for every town", async ({ page }) => {
  await toPeople(page);
  await typePlace(page, "חיפה");
  await H.goOn(page);
  await expect(mapRow(page, "חיפה")).toBeVisible({ timeout: 15000 });
  const shown = {};
  for (const t of ["חיפה", "תל אביב", "ירושלים"]) shown[t] = await mapRow(page, t).locator("input").inputValue();
  await toCheck(page);
  const got = await applied(page);
  for (const t of Object.keys(shown)) expect(got[t], t).toBe(shown[t]);
});

test("a place she typed that the gazetteer does not know has its own row, and the row decides", async ({ page }) => {
  await toPeople(page);
  await typePlace(page, "נווה צדק");
  await H.goOn(page);
  const row = page.locator("[data-wrap]").filter({ hasText: "נווה צדק" }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row).toContainText("הוספת במסך השמות");
  const shown = await row.getByRole("textbox").inputValue();
  expect(shown.length).toBeGreaterThan(1);
  await row.getByRole("textbox").fill("גבעת עדה");
  await toCheck(page);
  expect((await applied(page))["נווה צדק"]).toBe("גבעת עדה");
});

test("switching her typed place off on the places screen keeps it in clear", async ({ page }) => {
  await toPeople(page);
  await typePlace(page, "נווה צדק");
  await H.goOn(page);
  const row = page.locator("[data-wrap]").filter({ hasText: "נווה צדק" }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("checkbox").uncheck(); // "להחליף", checked means it will be replaced
  await toCheck(page);
  expect(await page.locator("[data-work] section").first().innerText()).toContain("נווה צדק");
  expect((await applied(page))["נווה צדק"]).toBeUndefined();
});

test("a town that already has a substitute in the case is shown with it, keeps it, and survives «קבוצה אחרת»", async ({ page }) => {
  const prof = { v: 1, name: "תיק יישובים", created: new Date().toISOString(), updated: new Date().toISOString(), mode: "real",
    rules: [{ value: "חיפה", kind: "PLACE", replacement: "אשדוד", auto: false }], allow: [], map: { "חיפה": "אשדוד" } };
  await H.serveEngineWithStub(page);
  await page.addInitScript((p) => { try { localStorage.setItem("redact-cases", JSON.stringify({ [p.name]: p })); } catch (_) {} }, prof);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "second.docx", DOC);
  await page.getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const row = mapRow(page, "חיפה");
  await expect(row).toBeVisible({ timeout: 15000 });
  expect(await row.locator("input").inputValue()).toBe("אשדוד");
  // no other town was handed the case's substitute
  for (const t of ["תל אביב", "ירושלים"]) expect(await mapRow(page, t).locator("input").inputValue()).not.toBe("אשדוד");
  await page.getByRole("button", { name: /קבוצה אחרת/ }).click();
  expect(await mapRow(page, "חיפה").locator("input").inputValue()).toBe("אשדוד");
  await toCheck(page);
  expect((await applied(page))["חיפה"]).toBe("אשדוד");
});
