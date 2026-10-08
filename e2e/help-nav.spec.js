const { test, expect } = require("./base");
const H = require("./helpers");

/* The way to help and to the site from inside the tool (the owner's approved features, 6.10; v66): a
   «עזרה» menu in the header (the tour, the welcome window, the questions on the site), and the site's
   links at the foot of every screen, in the site's own words and order. Links open in a new tab, so a
   document being worked on stays. */

const DOC = ["פרוטוקול דיון", "רחל פרידמן: אני מבקשת לפתוח.", "דוד כהן: אני המשיב.", "רחל פרידמן: תודה.", "דוד כהן: נסכם בכתב."].join("\n");
const help = (page) => page.locator("[data-help-btn]");
const menu = (page) => page.locator("#help-menu");

test("«עזרה» opens a menu of help, closes as a menu does, and each item does what it says", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await expect(help(page)).toHaveText("עזרה");
  await expect(help(page)).toHaveAttribute("aria-expanded", "false");
  await help(page).click();
  await expect(help(page)).toHaveAttribute("aria-expanded", "true");
  await expect(menu(page).locator("li")).toHaveText(["סיור על מסמך לדוגמה", "איך זה עובד", "שאלות נפוצות", "מדריך שימוש"]);
  await expect(menu(page).getByRole("link", { name: "מדריך שימוש" })).toHaveAttribute("href", "https://inkognito.co.il/help");
  const faq = menu(page).getByRole("link", { name: "שאלות נפוצות" });
  await expect(faq).toHaveAttribute("href", "https://inkognito.co.il/#faq");
  await expect(faq).toHaveAttribute("target", "_blank");

  // Escape closes it and gives the focus back to its button
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(help(page)).toBeFocused();
  // a press elsewhere closes it
  await help(page).click();
  await page.locator("main h1").click();
  await expect(menu(page)).toHaveCount(0);
  // and so does the focus going on past it
  await help(page).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  await expect(menu(page)).toHaveCount(0);

  // «איך זה עובד» opens the welcome window again
  await help(page).click();
  await menu(page).getByRole("button", { name: "איך זה עובד" }).click();
  await expect(page.getByRole("dialog", { name: "לפני שמתחילים" })).toBeVisible();
  await page.getByRole("button", { name: "להתחיל ישר" }).click();
  // «סיור על מסמך לדוגמה» starts the tour
  await help(page).click();
  await menu(page).getByRole("button", { name: "סיור על מסמך לדוגמה" }).click();
  await expect(page.locator("[data-tour]")).toContainText("קובץ או טקסט");
});

test("the tour from «עזרה» over an open document asks first, and «no» keeps the document", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  const asked = [];
  page.on("dialog", (d) => { asked.push(d.message()); d.dismiss(); });
  await help(page).click();
  await menu(page).getByRole("button", { name: "סיור על מסמך לדוגמה" }).click();
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toContain("לצאת מהמסמך?");
  await expect(page.locator("[data-tour]")).toHaveCount(0);
  await expect(page.getByText("case.docx")).toBeVisible();
});

test("the foot of the tool has the site's links, in a new tab, and stays clear of the review screen's bar", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const foot = page.getByRole("navigation", { name: "מידע ומסמכים משפטיים" });
  await expect(foot.getByRole("link")).toHaveText(["עמוד הבית", "תנאי שימוש", "מדיניות פרטיות", "הצהרת נגישות", "יצירת קשר"]);
  expect(await foot.getByRole("link").evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.getAttribute("target")]))).toEqual([
    ["https://inkognito.co.il/", "_blank"], ["https://inkognito.co.il/terms", "_blank"], ["https://inkognito.co.il/privacy", "_blank"],
    ["https://inkognito.co.il/accessibility", "_blank"], ["mailto:contact@inkognito.co.il", null],
  ]);
  // on the review screen, scrolled to the end, the links sit above the fixed bar, not under it
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const [f, b] = [await foot.getByRole("link").first().boundingBox(), await page.locator("[data-bar]").boundingBox()];
  expect(f.y + f.height, "the links end above the bar").toBeLessThanOrEqual(b.y + 1);
});
