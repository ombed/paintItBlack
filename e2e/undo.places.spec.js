const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Three reports from a real session.

   The places screen only ever offered towns from the 200-entry atlas that
   were not also ordinary words, because that is what the distance-preserving
   map can use. On a document whose places come from the larger gazetteer, or
   whose names double as words, the screen said no places were found while the
   tool had plainly found them. Everything found is now offered: the atlas
   towns as a distance-preserving group, the rest one at a time.

   Selecting a word in the document offered only kinds — person, body, place —
   that is, only ways to say yes this identifies someone. There was no way to
   say the opposite, that it is an ordinary word.

   And every decision was one-way. There is now an undo stack behind Ctrl+Z
   and a pair of arrows. */

const GAZ_DOC = [
  "תסקיר בעניין המשפחה",
  "המשפחה עברה מלוד לכפר ורדים בשנה שעברה.",
  "הילדה למדה בבית הספר המקומי.",
].join("\n");

const DOC = ["פרוטוקול", "רונית לוי: אני מבקשת לפתוח.", "רונית לוי: תודה."].join("\n");

async function toPlaces(page, doc) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
}

test("a place the map cannot use is still offered, not silently dropped", async ({ page }) => {
  await toPlaces(page, GAZ_DOC);
  // לוד is in the atlas but is also an ordinary word, so it is offered here
  // rather than in the distance group, and it comes switched off
  const rows = page.locator('span[data-tip="1"]');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  const names = await rows.allTextContents();
  expect(names).toContain("לוד");
  expect(names).toContain("כפר ורדים");
  // the screen never claims nothing was found while showing rows
  await expect(page.locator("main")).not.toContainText("לא נמצאו יישובים במסמך");
});

test("a selected word can be marked as an ordinary word", async ({ page }) => {
  await toPlaces(page, DOC);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
  if (await run.isVisible().catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });

  // select a word inside the document sheet
  await page.evaluate(() => {
    const el = document.querySelector("[data-mark]");
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  const popup = page.locator('[data-popup="1"]');
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("button", { name: /מילה רגילה/ })).toBeVisible();
});

test("Ctrl+Z takes a decision back, and the arrows do the same", async ({ page }) => {
  await toPlaces(page, DOC);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
  if (await run.isVisible().catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });

  const marks = page.locator("[data-mark]");
  const before = await marks.count();
  expect(before).toBeGreaterThan(0);

  // "do not replace" on the first card takes its replacements out of the text
  const dont = page.getByRole("button", { name: "אל תחליף" }).first();
  await expect(dont).toBeVisible({ timeout: 15000 });
  await dont.click();
  await expect.poll(() => marks.count(), { timeout: 20000 }).toBeLessThan(before);

  // Ctrl+Z brings them back
  await page.keyboard.press("Control+z");
  await expect.poll(() => marks.count(), { timeout: 20000 }).toBe(before);

  // the redo arrow takes them away again
  await page.getByRole("button", { name: "ביצוע חוזר" }).click();
  await expect.poll(() => marks.count(), { timeout: 20000 }).toBeLessThan(before);

  // and the undo arrow is the same as the shortcut
  await page.getByRole("button", { name: "ביטול הפעולה האחרונה" }).click();
  await expect.poll(() => marks.count(), { timeout: 20000 }).toBe(before);
});
