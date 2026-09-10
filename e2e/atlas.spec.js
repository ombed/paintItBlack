const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Places by kind, and the map that matches character before distance.

   On the real session a neighbourhood came out as a bracketed label, and a
   town could be swapped for any town at the right distance. Now the places
   screen says what the substitute shares with the original, from the table
   she reviews, and a neighbourhood gets a neighbourhood name. */

const DOC = [
  "תסקיר בעניין המשפחה",
  "המשפחה גרה בבני ברק, והאב עובד בחיפה.",
  "הילדה לומדת בשכונת הפרדס, ליד הבית של הסבתא.",
].join("\n");

test("the places screen says what the substitute shares with the town", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();

  const rows = page.locator('div:has(> button:text-is("אל תחליף"))');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });
  const names = await rows.locator('span[data-tip="1"]').allTextContents();
  expect(names).toContain("בני ברק");
  // every mapped row carries its note, and the haredi city stays haredi
  const notes = page.locator("[data-tags]");
  await expect(notes.first()).toBeVisible();
  expect(await notes.count()).toBe(names.length);
  const i = names.indexOf("בני ברק");
  const note = await notes.nth(i).textContent();
  expect(note).toContain("חרדי");
  expect(note).not.toContain("שונה: אוכלוסייה");
});

test("a neighbourhood keeps its kind in the document", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  // add the neighbourhood by hand as a place
  const box = page.getByPlaceholder(/שם מלא/).first();
  await box.fill("הפרדס");
  await box.press("Enter");
  const row = H.peopleRows(page).filter({ hasText: "הפרדס" }).first();
  await expect(row).toBeVisible();
  const kind = row.getByRole("combobox");
  await kind.selectOption("PLACE");
  await expect(kind).toHaveValue("PLACE");
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const mark = page.locator('[data-mark][data-val="הפרדס"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  const rep = (await mark.textContent()) || "";
  expect(rep).not.toMatch(/^\[/);           // never a label
  expect(rep).not.toBe("הפרדס");
  const text = await page.locator("[data-work] section").first().innerText();
  expect(text).toContain("בשכונת " + rep);  // the head word stays, the name changed
});
