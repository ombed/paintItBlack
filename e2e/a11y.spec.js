const { test, expect } = require("./base");
const H = require("./helpers");
const AxeBuilder = require("@axe-core/playwright").default;

/* Accessibility (outside review, batch D: M26–M32, L26–L30). Each finding has its own test, and
   axe (WCAG 2.1 A and AA) runs on every main screen and on the states the review found
   unnamed controls in. Screens are measured after their animations settle: a screen sliding
   in is half transparent, and its colours read as failing contrast. axe's own fetch of the
   Google Fonts stylesheet is turned off (preload), since the page's policy rightly refuses it. */

const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי מחיפה.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");
const settle = (page) => page.evaluate(async () => {
  const t0 = Date.now();
  while (document.getAnimations().some((a) => a.playState === "running") && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
});
async function axe(page, where) {
  await settle(page);
  const r = await new AxeBuilder({ page }).options({ preload: false }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${where}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")})`)).toEqual([]);
}
async function toPeople(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
async function toWork(page) {
  await toPeople(page);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("axe: entry, people, places and work screens, a selected card and the inline editor", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await axe(page, "entry");
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await axe(page, "people");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) { await axe(page, "places"); await run.click(); }
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await axe(page, "work");
  // a selected card shows "the same person as", which had no name (L27)
  await page.locator("[data-group]").first().click();
  await axe(page, "work, a card selected");
  await page.locator("[data-mark]").first().click();
  await expect(page.locator("[data-inline]")).toBeVisible();
  await axe(page, "work, the inline editor");
});

test("M28: what changes while she works is announced", async ({ page }) => {
  await toWork(page);
  await expect(page.locator('[data-bar-text][role="status"]')).toHaveCount(1);
  const counter = page.locator('span[aria-live="polite"][aria-atomic="true"]');
  await expect(counter).toHaveCount(1);
  // a download says where the file went, in the notice
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת Word" }).click();
  const anyway = page.getByRole("button", { name: "להוריד בכל זאת" });
  if (await anyway.isVisible()) await anyway.click();
  await dl;
  await expect(page.locator('[data-notice][role="status"]')).toBeVisible();
});

test("M29, M30: where a name appears, and choosing a card, work from the keyboard", async ({ page }) => {
  await toPeople(page);
  const tip = page.locator('[data-tip="1"]').first();
  await tip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-tip="panel"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const name = page.locator("[data-group] [data-kbd]").first();
  await name.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => !!window.__pib.state().sel)).toBe(true);
});

test("M31: an English answer runs left to right on the restore screen", async ({ page }) => {
  // the round trip as e2e/steps.spec.js drives it, on a document with nothing left pending
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", ["פרוטוקול דיון — התובעת: רונית לוי", "רונית לוי הגישה בקשה לצו הגנה.", "הדיון התקיים ביום שלישי."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
  const bar = page.locator("[data-bar]");
  await bar.getByRole("button", { name: /העתקה ל-AI|הועתק/ }).click();
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  const box = page.locator("textarea[aria-label='תשובת ה-AI']");
  await expect(box).toBeVisible();
  await box.fill("Based on the document, the plaintiff spoke first.");
  expect(await box.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
});

test("M32: Escape ends the tour, and a key press outside the lit area is stopped like a click", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" }); // the tour's sample document is not hers
  // a first visit, the way e2e/tour.spec.js starts it: the intro offers the tour
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const card = page.locator('[data-tour][role="dialog"]');
  await expect(card).toBeVisible({ timeout: 15000 });
  const toggle = page.getByRole("button", { name: "מצב יום או לילה" });
  const dark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const before = await dark();
  await toggle.focus();
  await page.keyboard.press("Enter");
  expect(await dark()).toBe(before);
  await expect(page.locator("[data-tour-nudge]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});

test("L26: with reduced motion asked for, nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const d = await page.evaluate(() => getComputedStyle(document.body).animationDuration + " " + getComputedStyle(document.body).transitionDuration);
  expect(d.split(" ").every((x) => parseFloat(x) <= 0.001)).toBe(true);
});

test("L28, L30: pressed and expanded states are exposed, and the file error is tied to its control", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles("e2e/fixtures/case-empty.docx");
  await expect(page.locator("[data-file-err]#file-err")).toBeVisible();
  expect(await page.locator('[data-tour-target="upload"]').getAttribute("aria-describedby")).toBe("file-err");
  const settings = page.locator("[data-settings-toggle]");
  if ((await settings.getAttribute("aria-expanded")) !== "true") await settings.click();
  const pressed = await page.getByRole("button", { name: "שם חלופי" }).getAttribute("aria-pressed");
  expect(["true", "false"]).toContain(pressed);
  await toWorkFrom(page);
  const sections = page.locator("[data-section]");
  expect(await sections.count()).toBeGreaterThan(0);
  for (const v of await sections.evaluateAll((els) => els.map((e) => e.getAttribute("aria-expanded")))) expect(["true", "false"]).toContain(v);
});
async function toWorkFrom(page) {
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("M26: at 200% zoom the document is still on the screen", async ({ page }) => {
  await toWork(page);
  // 200% zoom of a 1280×720 screen, set once the work screen is up
  await page.setViewportSize({ width: 640, height: 360 });
  await settle(page);
  const h = await page.evaluate(() => { let el = document.querySelector("[data-mark]"); while (el && getComputedStyle(el).overflowY !== "auto") el = el.parentElement; return el ? el.getBoundingClientRect().height : 0; });
  expect(h).toBeGreaterThanOrEqual(250);
});

test("M27: an input's border is at least 3:1 against its background", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector("textarea") || document.querySelector("input:not([type=checkbox]):not([type=file])");
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const L = ([r, g, b]) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    let bgEl = el, bg = "rgba(0, 0, 0, 0)";
    while (bgEl && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bgEl = bgEl.parentElement; bg = bgEl ? getComputedStyle(bgEl).backgroundColor : "rgb(255,255,255)"; }
    const a = L(rgb(getComputedStyle(el).borderTopColor)), b = L(rgb(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(r).toBeGreaterThanOrEqual(3);
});
