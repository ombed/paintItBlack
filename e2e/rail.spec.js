const { test, expect } = require("./base");
const H = require("./helpers");

/* Four complaints about the check screen, from real use.

   The manual add-a-replacement card was hard-coded below all five accordions
   and was the only card that could not be collapsed, so it sat about a screen
   below the fold exactly when the user had just spotted a missed value.

   The audit bundle lived in the fifth and last section, collapsed, under a
   heading about what was cleaned from the file, inside a sub-box called
   sending for review: hard to find even when looking for it.

   And the bottom bar floated over the document and the rail, with the space
   left for it hardcoded in three places that nothing tied to its real height.
   On a phone it wraps to several lines and covered the bottom of the sheet. */

const DOC = ["תסקיר בעניין המשפחה", "רונית לוי הגישה בקשה.", "הדיון נקבע בחיפה."].join("\n");

async function toCheckScreen(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("adding a missed value by hand sits at the top of the rail", async ({ page }) => {
  await toCheckScreen(page);
  const manual = page.getByPlaceholder("שם או פרט שפוספס");
  await expect(manual).toBeVisible();

  // above the first accordion, rather than below all of them
  const manualTop = await manual.boundingBox();
  const firstSection = page.getByRole("button", { name: /לבדיקה|מה נמצא והוחלף/ }).first();
  const sectionTop = await firstSection.boundingBox();
  expect(manualTop.y).toBeLessThan(sectionTop.y);
});

test("the bundle export is its own section, open, and says what it is", async ({ page }) => {
  await toCheckScreen(page);
  // visible without opening anything
  await expect(page.getByRole("button", { name: /חבילת בדיקה/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /העתקת יומן השימוש/ })).toBeVisible();
  // and it is no longer buried inside the section about what was cleaned
  await expect(page.getByRole("button", { name: /עזרה בשיפור הזיהוי/ })).toBeVisible();
});

/* Up to v56 the package also held the redacted document and opened a mail to an address kept
   in the browser. The user now sends the package herself and the document separately, only
   when she decides to, so the package carries no document and no address is kept. */
test("the check package holds the log only, and no mail address is kept", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("redact-feedback-mail", "someone@example.com"); } catch (_) {} });
  await toCheckScreen(page);
  expect(await page.evaluate(() => localStorage.getItem("redact-feedback-mail"))).toBeNull();
  await expect(page.getByPlaceholder(/כתובת המייל/)).toHaveCount(0);

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /חבילת בדיקה/ }).click();
  const download = await dl;
  const zip = require("fs").readFileSync(await download.path());
  const files = require("../scripts/harvest-shapes.js").unzip(zip);
  const names = files.map((f) => f.name).sort();
  expect(names).toEqual(["README.txt", "session-log.json"]);
  // the product is InKognito from v60: the package carries its name, and its README says it on line one
  expect(download.suggestedFilename()).toMatch(/^inkognito-package-\d{4}-\d{2}-\d{2}\.zip$/);
  const readme = files.find((f) => f.name === "README.txt").data.toString("utf8");
  // the whole version: a small fix is v73.1 (scripts/bump.js, 9.10.2026)
  expect(readme.split("\n")[0]).toMatch(/^InKognito v\d+(?:\.\d+)?$/);
});

test("the bottom bar never covers the document", async ({ page }) => {
  await toCheckScreen(page);
  const gap = await page.evaluate(() => {
    const bar = document.querySelector("[data-bar]");
    const main = document.querySelector("[data-work]");
    if (!bar || !main) return null;
    const measured = getComputedStyle(document.documentElement).getPropertyValue("--bar-h").trim();
    return { measured, barH: bar.offsetHeight, padding: parseFloat(getComputedStyle(main).paddingBottom) };
  });
  expect(gap).not.toBeNull();
  // the reserved space comes from the bar's real height, not from a guess
  expect(gap.measured).toBe(gap.barH + "px");
  expect(gap.padding).toBeGreaterThanOrEqual(gap.barH);
});

test("the bar re-measures when it wraps on a narrow screen", async ({ page }) => {
  await toCheckScreen(page);
  const wide = await page.evaluate(() => document.querySelector("[data-bar]").offsetHeight);
  await page.setViewportSize({ width: 420, height: 780 });
  await expect.poll(async () => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bar-h").trim()
  )).toBe(await page.evaluate(() => document.querySelector("[data-bar]").offsetHeight + "px"));
  const narrow = await page.evaluate(() => document.querySelector("[data-bar]").offsetHeight);
  expect(narrow).toBeGreaterThanOrEqual(wide);
});

/* The measured space (v25) never reached a phone: the phone stylesheet still held one of the old fixed
   numbers, padding-bottom:132px!important, which beat it. The bar on a phone is two or three lines, 156px at
   390px and more at 320px, so the end of the document and of the findings stayed under it. */
for (const width of [390, 320]) {
  test(`on a phone too, the space kept under the work screen is the bar's measured height (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await H.serveEngineWithStub(page);
    await H.boot(page);
    await page.locator("[data-settings-toggle]").click();
    await page.getByRole("checkbox").first().uncheck();
    await H.upload(page, "case.docx", DOC);
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    await H.goOn(page);
    const run = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
    await H.throughPlaces(page, run);
    await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
    const gap = await page.evaluate(() => {
      const bar = document.querySelector("[data-bar]"), main = document.querySelector("[data-work]");
      return { barH: bar.offsetHeight, padding: parseFloat(getComputedStyle(main).paddingBottom) };
    });
    expect(gap.padding).toBeGreaterThanOrEqual(gap.barH);
    // at the foot of the page, the work screen's last line clears the bar
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clear = await page.evaluate(() => {
      const main = document.querySelector("[data-work]"), bar = document.querySelector("[data-bar]");
      // the screen's own blocks (the pane switch, the document, the findings): what scrolls inside them is
      // clipped by them, so their edges are where the content ends
      const last = [...main.children].filter((e) => e.getClientRects().length)
        .reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
      return bar.getBoundingClientRect().top - last;
    });
    expect(clear).toBeGreaterThanOrEqual(0);
  });
}
