const { test, expect } = require("./base");
const H = require("./helpers");

/* Release 3, from the second real session.

   A conflicting decision used to coexist with the old one ("קפדן" was both a
   rule and allowed). Removing a town from the places screen recomputed the
   map and changed the others; with one town left the map dissolved and the
   leftover got a random gazetteer name. "Same person as" on the card copied a
   fake name instead of linking the names. Dates were deleted, and the AI
   complained the date was missing. */

const DOC = [
  "פרוטוקול דיון",
  "רונית לוי: אני מבקשת לפתוח. הדיון הקודם היה ב-11.2.2026.",
  "דנה ברקוביץ: אני מסכימה עם רונית לוי. גרנו בחיפה ואחר כך בתל אביב.",
  "רונית לוי: תודה. נסענו לירושלים.",
  "דנה ברקוביץ: נכון.",
].join("\n");

async function toPeople(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
async function toCheck(page) {
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
const sheet = (page) => page.locator("[data-work] section").first();

test("a full date is shifted, not deleted, and the same offset holds for the document", async ({ page }) => {
  await toPeople(page);
  await H.goOn(page);
  await toCheck(page);
  const text = await sheet(page).innerText();
  expect(text).not.toContain("11.2.2026");
  const m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  expect(m).toBeTruthy();
  // the card names the choice
  const card = page.locator("[data-group]").filter({ hasText: m[0] }).first();
  await expect(card).toBeVisible();
});

test("removing a town keeps the other approved pairs, and a dissolved map hands its name over", async ({ page }) => {
  await toPeople(page);
  await H.goOn(page);
  const rows = page.locator('div:has(> button:text-is("אל תחליף"))');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });
  const names = await rows.locator('span[data-tip="1"]').allTextContents();
  const tos = await rows.locator("input").evaluateAll((els) => els.map((e) => e.value));
  expect(names.length).toBeGreaterThanOrEqual(3);
  // remove the first town: the others keep their substitutes
  await rows.first().getByRole("button", { name: "אל תחליף" }).click();
  const names2 = await rows.locator('span[data-tip="1"]').allTextContents();
  const tos2 = await rows.locator("input").evaluateAll((els) => els.map((e) => e.value));
  for (let i = 0; i < names2.length; i++) {
    const j = names.indexOf(names2[i]);
    expect(tos2[i]).toBe(tos[j]);
  }
  // remove another: one town left, the map dissolves, and its approved name is kept in the extra list
  await rows.first().getByRole("button", { name: "אל תחליף" }).click();
  const last = names2[1], lastTo = tos2[1];
  const extra = page.locator("[data-wrap]").filter({ hasText: last }).first();
  await expect(extra).toBeVisible();
  // v36 (UX #10): the row also carries a "להחליף" checkbox, so name the text box
  expect(await extra.getByRole("textbox").inputValue()).toBe(lastTo);
});

test("'same person as' on the card links the names, and a conflicting decision replaces the old one with a notice", async ({ page }) => {
  await toPeople(page);
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("שלווה ליבוביץ"); await input.press("Enter");
  // decline the merge suggestion on the people screen, so the two reach the check screen apart
  const sug = page.locator("[data-merge-sug]").first();
  if (await sug.isVisible({ timeout: 2000 }).catch(() => false)) await sug.getByRole("button", { name: /שני אנשים/ }).click();
  await H.goOn(page);
  await toCheck(page);
  // link דנה ברקוביץ to רונית לוי from the card
  const mark = page.locator('[data-mark][data-val="דנה ברקוביץ"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  const before = await mark.textContent();
  const ronit = await page.locator('[data-mark][data-val="רונית לוי"]').first().textContent();
  await mark.click();
  const card = page.locator("[data-group]").filter({ hasText: "דנה ברקוביץ" }).first();
  await card.getByRole("combobox").first().selectOption("רונית לוי");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain(before);
  const text = await sheet(page).innerText();
  expect(text.split(ronit).length - 1).toBeGreaterThanOrEqual(4);

  // now "don't replace" on a listed name: the rule goes, and the notice says so, with undo
  const ronitMark = page.locator('[data-mark][data-val="רונית לוי"]').first();
  await ronitMark.click();
  const rcard = page.locator("[data-group]").filter({ hasText: "רונית לוי" }).first();
  await rcard.getByRole("button", { name: "אל תחליף" }).click();
  const notice = page.locator("[data-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("רונית לוי");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("רונית לוי");
  await notice.getByRole("button", { name: /ביטול/ }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("רונית לוי");
});
