const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Three things a real session showed were silent.

   Deleting a chip on the people screen put the name on the never-replace
   list with no trace: nothing on screen, nothing in the log, no way back
   short of retyping it. Editing a replacement did nothing eight times in a
   row, because the card's value and the rule's value were not the same
   string. And "ordinary word" from the document popup did nothing when the
   selection carried a prefix letter, because it handed the raw drag to the
   allow list. */

// both speakers recur: a speaker turn reaches the list only when it repeats
const DOC = [
  "פרוטוקול דיון",
  "רונית לוי: אני מבקשת לפתוח.",
  "דנה ברקוביץ: אני מסכימה עם רונית לוי.",
  "רונית לוי: תודה. דיברתי עם דנה ברקוביץ אתמול.",
  "דנה ברקוביץ: נכון, דיברנו.",
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
  await H.goButton(page).click();
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 3000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("a deleted chip is shown as kept, and can be put back", async ({ page }) => {
  await toPeople(page);
  const names = await H.listedNames(page);
  expect(names).toContain("דנה ברקוביץ");

  // delete one
  const row = H.peopleRows(page).filter({ hasText: "דנה ברקוביץ" }).first();
  await row.getByRole("button", { name: "הסרה" }).click();
  expect(await H.listedNames(page)).not.toContain("דנה ברקוביץ");

  // it is visible as kept, not gone
  const strip = page.getByText("נשארים כמו שהם:");
  await expect(strip).toBeVisible();
  const undo = page.getByRole("button", { name: /דנה ברקוביץ/ });
  await expect(undo).toBeVisible();

  // and it comes back
  await undo.click();
  expect(await H.listedNames(page)).toContain("דנה ברקוביץ");
  await expect(page.getByText("נשארים כמו שהם:")).toHaveCount(0);
});

test("a kept name is listed on the check screen with a way back", async ({ page }) => {
  await toPeople(page);
  await H.peopleRows(page).filter({ hasText: "דנה ברקוביץ" }).first().getByRole("button", { name: "הסרה" }).click();
  await toCheck(page);

  // the document still holds the name she kept, and the rail says so
  await expect(page.locator("[data-work] section").first()).toContainText("דנה ברקוביץ");
  // the review section opens on its own: a kept name is a decision awaiting confirmation
  const undo = page.locator("aside").getByRole("button", { name: /דנה ברקוביץ/ }).first();
  await expect(undo).toBeVisible({ timeout: 10000 });
  await undo.click();
  // now it is replaced like the others
  await expect.poll(() => page.locator("[data-work] section").first().innerText(), { timeout: 15000 }).not.toContain("דנה ברקוביץ");
});

test("editing a replacement changes the document", async ({ page }) => {
  await toPeople(page);
  await toCheck(page);
  const marks = page.locator('[data-mark][data-val="רונית לוי"]');
  await expect(marks.first()).toBeVisible({ timeout: 15000 });
  const before = await marks.first().textContent();

  // open the card by clicking its mark, type a new substitute, save. The
  // manual-add card at the top of the rail has a box with the same
  // placeholder, so the card is picked by its value.
  await marks.first().click();
  const box = page.locator("[data-group]").filter({ hasText: "רונית לוי" }).getByPlaceholder("תחליף").first();
  await expect(box).toBeVisible({ timeout: 10000 });
  await box.fill("מיכל ברנע");
  await box.press("Enter");

  await expect.poll(() => marks.first().textContent(), { timeout: 15000 }).toBe("מיכל ברנע");
  expect(before).not.toBe("מיכל ברנע");
});

test("marking an ordinary word from a prefixed selection resolves to the marked value", async ({ page }) => {
  await toPeople(page);
  await toCheck(page);
  // select the whole mark for דנה ברקוביץ, then extend to include a prefix letter
  // is not possible on a replaced word, so select the mark itself: equality holds
  const mark = page.locator('[data-mark][data-val="דנה ברקוביץ"]').first();
  await expect(mark).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector('[data-mark][data-val="דנה ברקוביץ"]');
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  const popup = page.locator('[data-popup="1"]');
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: /מילה רגילה/ }).click();
  // the allow list got the marked value, not the fake name on screen
  await expect.poll(() => page.locator("[data-work] section").first().innerText(), { timeout: 15000 }).toContain("דנה ברקוביץ");
  // and the kept name is listed in the review section, which opens because a kept name is a decision
  await expect(page.locator("aside").getByRole("button", { name: /דנה ברקוביץ/ }).first()).toBeVisible({ timeout: 10000 });
});
