const { test, expect } = require("./base");
const H = require("./helpers");

/* Found by the user, after three QA rounds missed them.

   Quotation marks: a name or a school written inside quotes ("אלונים") was never
   replaced, its card said "not in the document", and a second card appeared for
   the same word with the closing quote. The word boundary counted every " as a
   letter so that abbreviations like עו"ד stay whole.

   The tour: scrolling made the spotlight trail behind and drift off the screen,
   and a click outside the lit area reached the page and broke the tour. */

const sheet = (page) => page.locator("[data-work] section").first();
const QUOTED = [
  "פרוטוקול",
  "שירה ברקוביץ: הילדה לומדת בבית הספר \"אלונים\" בקריית אתא.",
  "שירה ברקוביץ: המורה \"רחל פרידמן\" אמרה ש\"אלונים\" בית ספר טוב. עו\"ד רונן אלמליח הגיע.",
].join("\n");

test("a name in quotation marks is replaced, found in context, and has one card", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", QUOTED);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("רחל פרידמן"); await input.press("Enter");
  // the chip finds its sentences, quotes and all
  const chip = page.locator('span[data-tip="1"]').filter({ hasText: "רחל פרידמן" }).first();
  await chip.hover();
  await expect(page.locator('[data-tip="panel"]')).toContainText("המורה");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  // add the school from the work screen, as she would
  await page.getByPlaceholder("שם או פרט שפוספס").fill("אלונים");
  await page.getByRole("button", { name: "הוספה והחלפה" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("אלונים");
  const text = await sheet(page).innerText();
  expect(text).not.toContain("רחל פרידמן");
  expect(text).toContain("עו\"ד");
  // the quotes themselves stay in the text
  expect(text).toMatch(/"[א-ת ]+"/);
  const titles = await page.evaluate(() => [...document.querySelectorAll("[data-group]")].map((g) => g.querySelector("span").textContent));
  expect(titles.filter((t) => t.includes("אלונים"))).toHaveLength(1);
  expect(titles.some((t) => /["״]$/.test(t))).toBe(false);
  await expect(page.locator("[data-work]")).not.toContainText("לא מופיע במסמך הזה");
});

async function tourToWork(page) {
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  return tour;
}

for (const vp of [{ width: 1280, height: 600 }, { width: 390, height: 700 }]) {
  test(`the spotlight moves with the page while scrolling, with no lag (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize(vp);
    const tour = await tourToWork(page);
    await tour.getByRole("button", { name: "המשך", exact: true }).click();
    await expect(tour).toContainText("יישובים", { timeout: 20000 });
    await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
    await expect(tour).toContainText("מסך הבדיקה", { timeout: 20000 });
    await page.waitForTimeout(400);
    await page.mouse.move(vp.width / 2, vp.height / 2);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 250);
      // one frame after the scroll, the spotlight is already on its target
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      // on the visible part of its target: since v70 the header and the bottom bar cut it off (spotRect), and
      // the self-check's spotlight-drift rule holds the spotlight to that part
      expect(await page.evaluate(() => (window.__pib.check(true) || []).filter((f) => f.rule === "spotlight-drift").map((f) => f.detail || f.rule))).toEqual([]);
    }
    // and it does not pull the page back
    const y = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
  });
}

test("a click outside the lit area does not reach the page, and the tour says why", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  const tour = await tourToWork(page);
  // the back button: its ‹ is a drawn chevron now, hidden from screen readers, so its name is the word
  // alone, the same as the header's step «קובץ»; [data-back] tells the two apart
  const back = page.locator("[data-back]").and(page.getByRole("button", { name: "קובץ", exact: true }));
  await expect(back).toBeVisible();
  await expect(back.locator('svg[data-icon="chevron-right"]')).toBeVisible();
  await back.click({ force: true });
  await expect(page.getByRole("heading", { name: "מי מופיע בתיק" })).toBeVisible();
  await expect(tour).toContainText("מי בתיק");
  await expect(page.locator("[data-tour-nudge]")).toBeVisible();
  // the lit area itself still works: the tour can go on
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await expect(page.locator("[data-tour-nudge]")).toHaveCount(0);
});

test("on a phone, a header button inside the lit area does not take the tour away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const tour = await tourToWork(page);
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(tour).toContainText("מסך הבדיקה", { timeout: 20000 });
  await page.mouse.move(195, 350);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  const back = page.locator("[data-back]").filter({ hasText: "מי בתיק" });
  const box = await back.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("[data-bar]")).toBeVisible();
  await expect(tour).toContainText("מסך הבדיקה");
  await expect(page.locator("[data-tour-nudge]")).toBeVisible();
  // a word in the document, inside the target, still opens its editor
  await page.locator("[data-work] [data-mark]").first().click();
  await expect(page.locator("[data-inline]")).toBeVisible();
});
