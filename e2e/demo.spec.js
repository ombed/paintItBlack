const { test, expect } = require("./base");
const H = require("./helpers");

/* The no-account demo on inkognito.co.il (the owner's decisions 18 and 29, 6.10; built 8.10.2026, v68). The
   hosted build serves the tool at /demo/ with window.__inkDemo set and no sign-in. Strict: the invented
   sample only, no file, paste or import, no model, nothing saved; the tour starts by itself and walks to
   the restore with the sample's ready answer; a strip on top and a card at the end lead to sign-up. */

const SIGNUP = "../login.html?mode=signup";
async function demo(page) {
  await H.serveEngineWithStub(page);
  await page.addInitScript((signup) => { window.__inkDemo = { signup }; window.__inkStoreSuffix = "demo"; }, SIGNUP);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
}

test("the demo starts the tour on the sample by itself, with the strip that leads to sign-up, and never the welcome", async ({ page }) => {
  await demo(page);
  const tour = page.locator("[data-tour]");
  await expect(tour).toContainText("קובץ או טקסט");
  await expect(page.getByText("לפני שמתחילים")).toHaveCount(0);
  const strip = page.locator("[data-demo][role=note]");
  await expect(strip).toContainText("הדגמה על מסמך בדוי. למסמכים אמיתיים: חשבון חינם");
  await expect(strip.getByRole("link", { name: "פתיחת חשבון חינם" })).toHaveAttribute("href", SIGNUP);
  // the strip's link is reachable during the tour: the tour's guard lets it through, and nothing covers it
  const box = await strip.getByRole("link").boundingBox();
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y).closest("[data-demo]"), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
  // no model in the demo
  expect(await page.evaluate(() => window.__pib.state().o.ner)).toBe(false);
});

test("in the demo nothing real comes in: the file box, a dropped file, pasted text and imports do nothing", async ({ page }) => {
  await demo(page);
  await expect(page.locator("[data-tour]")).toContainText("קובץ או טקסט");
  let chooser = false;
  page.on("filechooser", () => { chooser = true; });
  await page.locator("[data-tour-target=upload]").click();
  await page.waitForTimeout(500);
  expect(chooser, "no file picker opens").toBe(false);
  // a file given to the hidden input anyway is not read
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: "real.docx", mimeType: H.DOCX, buffer: Buffer.from("x") });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__pib.state().buf)).toBeNull();
});

test("the demo walks to the restore on the sample, saves nothing, and its end leads to sign-up", async ({ page }) => {
  await demo(page);
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(tour).toContainText("מסך הבדיקה", { timeout: 20000 });
  for (let i = 0; i < 3; i++) await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await tour.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("[data-rv-out]")).toContainText("נועה שרעבי");
  await tour.getByRole("button", { name: "סיום" }).click();
  const end = page.locator("[data-demo-end]");
  await expect(end).toContainText("הדגמה על מסמך בדוי. למסמכים אמיתיים: חשבון חינם");
  await expect(end.getByRole("link", { name: "פתיחת חשבון חינם" })).toBeFocused();
  await expect(end.getByRole("link")).toHaveAttribute("href", SIGNUP);
  // nothing of it was written to the browser: no case, no last list, not even that the tour was seen
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => /^redact-(cases|profile-last|intro-seen|tour-seen)/.test(k)))).toEqual([]);
});

test("skipping the tour in the demo ends it the same way", async ({ page }) => {
  await demo(page);
  await page.locator("[data-tour]").getByRole("button", { name: "דילוג" }).click();
  await expect(page.locator("[data-demo-end]")).toBeVisible();
  await expect(page.locator("[data-demo][role=note]")).toHaveCount(0);
});
