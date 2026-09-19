const { test, expect } = require("./base");
const H = require("./helpers");
const { disturb } = require("./unruly");

/* The main journeys, walked by a misbehaving user (docs/QUALITY-PLAN.md, layer 3).

   Each journey is the straight path the other specs already cover, with
   disturb() between the steps: scrolling the page and every pane, a narrower
   window and back, a click on empty space, a double-click on a word, Tab and
   Escape, and Back answered "stay". After each of those the app checks its own
   promises (layer 2), and the screen must still be the one the user was on.
   Every journey runs at a desktop, a laptop and a phone size. */

const SIZES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
];

// everyone speaks twice, so the list fills without the model; two towns give the places screen
const DOC = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח. גרנו בחיפה ואחר כך בתל אביב.",
  "דוד כהן: הגעתי מ\"חיפה\" הבוקר.",
  "רחל פרידמן: תודה. הדיון הקודם היה ב-11.2.2026.",
  "דוד כהן: נכון, ואני מסכים עם רחל פרידמן.",
  "רחל פרידמן: נסכם בכתב.",
].join("\n");

// on a phone the settings, and the model switch with them, sit behind a toggle
async function modelOff(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
}

async function toPlacesOrWork(page) {
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run).toBeVisible({ timeout: 15000 });
  return run;
}

for (const size of SIZES) {
  test.describe(`at ${size.name} size`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("entry to restore, disturbed between every step", async ({ page }) => {
      await H.serveEngineWithStub(page);
      await H.boot(page);
      await modelOff(page);
      await disturb(page, "entry, empty");

      await H.upload(page, "hearing.docx", DOC);
      await disturb(page, "entry, file chosen");

      await H.startScan(page);
      await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
      await disturb(page, "people");
      const names = await H.listedNames(page);
      for (const n of ["רחל פרידמן", "דוד כהן"]) expect(names).toContain(n);

      await H.goOn(page);
      const run = await toPlacesOrWork(page);
      await disturb(page, "places");

      await run.click();
      await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
      await disturb(page, "work");

      // an open editor stays on its word while the user scrolls and resizes around it
      const mark = page.locator('[data-mark][data-val="רחל פרידמן"]').first();
      await mark.scrollIntoViewIfNeeded();
      await mark.click();
      await expect(page.locator("[data-inline]")).toBeVisible();
      await disturb(page, "work, editor open", { outside: false, escape: false, dbl: false });
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-inline]")).toHaveCount(0);

      // the text that leaves has no real name, and the answer comes back with them
      const text = await page.locator("[data-work] section").first().innerText();
      for (const s of ["רחל פרידמן", "דוד כהן", "חיפה"]) expect(text).not.toContain(s);
      await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
      await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל-AI|הועתק/ }).click();
      const pending = page.getByRole("button", { name: "בכל זאת", exact: true });
      if (await pending.isVisible({ timeout: 800 }).catch(() => false)) await pending.click();
      const copied = await page.evaluate(() => window.__copied || "");
      const fake = copied.match(/([֐-׿]+ [֐-׿]+): אני מבקשת/);
      expect(fake).toBeTruthy();

      await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
      await expect(page.getByPlaceholder("הדבקת תשובת ה-AI…")).toBeVisible();
      await disturb(page, "restore, empty");
      await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill("לדעתי " + fake[1] + " צריכה להגיש תצהיר.");
      await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
      await expect(page.locator("main")).toContainText("רחל פרידמן צריכה להגיש");
      await disturb(page, "restore, result");
    });

    test("the tour, disturbed at every step", async ({ page }) => {
      await H.serveEngineWithStub(page);
      await page.goto("/index.html");
      await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
      await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
      const tour = page.locator("[data-tour]");
      const next = () => tour.getByRole("button", { name: "המשך", exact: true }).click();
      // Back is not guarded in the tour by design: the sample is disposable
      const T = { back: false };

      await expect(tour).toContainText("קובץ או טקסט");
      await disturb(page, "tour 1", T);
      await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
      await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
      await disturb(page, "tour 2, people", T);
      await next();
      await expect(tour).toContainText("יישובים", { timeout: 20000 });
      await disturb(page, "tour 3, places", T);
      await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
      await expect(tour).toContainText("מסך הבדיקה", { timeout: 20000 });
      await disturb(page, "tour 4, check", T);
      await next();
      await expect(tour).toContainText("שמירה");
      await disturb(page, "tour 5, save", T);
      await next();
      await expect(tour).toContainText("העתקה ל-AI");
      await disturb(page, "tour 6, copy", T);
      await next();
      await expect(tour).toContainText("זהו");
      await disturb(page, "tour 7, end", T);
      await tour.getByRole("button", { name: "סיום" }).click();
      await expect(tour).toHaveCount(0);
    });

    test("a second document in a case, disturbed between every step", async ({ page }) => {
      await H.serveEngineWithStub(page);
      await H.boot(page);
      await modelOff(page);
      await H.upload(page, "first.docx", DOC);
      await H.startScan(page);
      await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
      await page.locator("[data-case-field] input").fill("פרידמן נ׳ כהן");
      await H.goOn(page);
      await (await toPlacesOrWork(page)).click();
      await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
      await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")))).toContain("פרידמן נ׳ כהן");
      const firstFake = await page.locator('[data-mark][data-val="רחל פרידמן"]').first().textContent();

      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "מסמך חדש" }).click();
      await expect(page.getByRole("heading", { name: /מה יוצא מהמסמך/ })).toBeVisible();
      await disturb(page, "second, entry");
      await H.upload(page, "second.docx", "המשך הדיון\nרחל פרידמן: חזרתי.\nדוד כהן: גם אני.\nרחל פרידמן: נתחיל.");
      await page.getByRole("button", { name: "שימוש בתיק הזה" }).click();
      await expect(page.locator("[data-case-chip]")).toContainText("פרידמן נ׳ כהן");
      await disturb(page, "second, case attached");

      await H.startScan(page);
      await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
      await disturb(page, "second, people");
      await H.goOn(page);
      await (await toPlacesOrWork(page)).click();
      await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
      await disturb(page, "second, work");
      // the case keeps each person's pseudonym across documents
      expect(await page.locator('[data-mark][data-val="רחל פרידמן"]').first().textContent()).toBe(firstFake);
    });
  });
}

// Found by the journeys above: on a phone the places screen rises into place, and a
// tooltip opened while it rose stayed a few pixels below its word, since nothing
// but a scroll or a resize re-placed it.
test("a tooltip opened while the screen rises ends on its word", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  // the moment the places rows exist, while the screen still rises: hover the first town
  const town = page.locator('div:has(> button:text-is("אל תחליף")) span[data-tip="1"]').first();
  await town.waitFor({ state: "attached", timeout: 15000 });
  const b = await town.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator('[data-tip="panel"]')).toBeVisible();
  // the automatic self-check at the end measures the tooltip against its word
});
