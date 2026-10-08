const { test, expect } = require("./base");
const H = require("./helpers");

/* The tour holds the page (the gap review of 6.10, the tour lens; fixed 8.10.2026, v69). The lens found: the
   wheel and the keys moved the page under the tour, and on the save step the spotlight lost its target for good;
   Tab and Enter reached the dimmed page (typing went into the paste box, Enter on the rail chose a card); and
   browser Back left the tool, where the owner decided it should close the tour (decision 27). */

async function tourAt(page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await expect(tour).toContainText("קובץ או טקסט");
  return tour;
}
const scrollY = (page) => page.evaluate(() => [window.scrollY, document.body.scrollTop].join(","));
// the spotlight is on its step's target: the self-check's own rule (selfCheck, "spot-off-target")
const spotOk = (page) => page.evaluate(() => !(window.__pib.check(true) || []).some((f) => /spot/.test(f.rule)));

test("the wheel and the keys do not move the page under the tour", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  await tourAt(page, 1440, 560);
  expect(await page.evaluate(() => document.body.scrollHeight > window.innerHeight), "the entry screen is taller than the window, so it could move").toBe(true);
  const y0 = await scrollY(page);
  await page.mouse.move(400, 450);
  await page.mouse.wheel(0, 800);
  for (const k of ["PageDown", "End", "Space", "ArrowDown"]) await page.keyboard.press(k);
  await page.waitForTimeout(300);
  expect(await scrollY(page)).toBe(y0);
});

test("on the save step the spotlight stays on its target whatever the wheel and the keys do", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const tour = await tourAt(page);
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(tour).toContainText("מסך הבדיקה", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("שמירה");
  await page.waitForTimeout(400);
  await expect.poll(() => spotOk(page)).toBe(true);
  for (const dy of [600, -600, 1200]) { await page.mouse.move(300, 300); await page.mouse.wheel(0, dy); }
  for (const k of ["PageDown", "PageUp", "End", "Home", "Space"]) await page.keyboard.press(k);
  await page.waitForTimeout(400);
  expect(await spotOk(page), "the spotlight is still on the save card").toBe(true);
});

test("nothing outside the lit area takes the keyboard: typing does not reach the paste box", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const tour = await tourAt(page);
  const box = page.getByPlaceholder("הדבקת טקסט לבדיקה…");
  await box.focus();
  await expect(tour).toBeFocused();
  await page.keyboard.type("Rachel");
  await page.keyboard.type("רחל פרידמן");
  await expect(box).toHaveValue("");
});

test("browser Back closes the tour and stays in the tool; closing it by its button leaves no step behind", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const tour = await tourAt(page);
  const url = page.url();
  await page.evaluate(() => window.history.back());
  await expect(tour).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(page.getByRole("button", { name: /בחירת קובץ/ })).toBeVisible();
  // started again and closed by its ✕: its history entry goes with it
  await page.getByRole("button", { name: "סיור על מסמך לדוגמה" }).click();
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "סגירת הסיור" }).click();
  await expect(tour).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window.history.state || {}).pib === "tour")).toBe(false);
  // and the page scrolls again
  expect(await page.evaluate(() => document.documentElement.classList.contains("touring"))).toBe(false);
});

/* On a phone the review screen shows one pane at a time, and the save step's field is in «ממצאים ובדיקה»: the
   step asked to type a case name in «השדה המסומן» over the document, with nothing lit (the tour lens, 6.10). */
test("on a phone the save step shows the pane its field is in, lit; Back to the document's step shows the document", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const tour = await tourAt(page, 390, 844);
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(tour).toContainText("מסך הבדיקה", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("שמירה");
  await expect(page.locator("[data-tour-target=case]")).toBeVisible();
  await expect(page.locator("[data-spot]")).toBeVisible();
  await expect.poll(() => spotOk(page)).toBe(true);
  await tour.getByRole("button", { name: "חזרה" }).click();
  await expect(tour).toContainText("מסך הבדיקה");
  await expect(page.locator("[data-work] section").first()).toBeVisible();
});

// the tour lens, 6.10: on a step whose target was not on the screen, every click went through to the page
test("a step whose target is not on the screen lets no click through", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const tour = await tourAt(page);
  // with no target there is no spotlight and no dimmed layer over the page: the click reaches the page itself
  await page.evaluate(() => { document.querySelector("[data-tour-target=upload]").removeAttribute("data-tour-target"); window.dispatchEvent(new window.Event("resize")); });
  await expect(page.locator("[data-spot]")).toHaveCount(0);
  const dark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const before = await dark();
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();
  expect(await dark()).toBe(before);
  await expect(tour.locator("[data-tour-nudge]")).toBeVisible();
});
