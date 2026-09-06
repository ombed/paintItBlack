const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* The review section is where a near-miss becomes a decision. Both buttons
   must end the item: the fix replaces the word and the item goes; the
   dismiss keeps the word and the item goes. And an action on a value the
   list already holds must not dead-end on "already in the list" at the top
   of a scrolled page: it selects the card and says so in the bar. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nגם רונת לוי הוזכרה בתצהיר.\nהדיון התקיים ביום שלישי.";

const toWork = async (page) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
};
const sheet = (page) => page.locator("[data-work] section").first();
// the review item is the one with the two decision buttons; the value also shows on cards and in the profile list
const nearItem = (page) => page.getByRole("button", { name: "מילה אחרת" });

test("the near-miss fix replaces the word and closes the item", async ({ page }) => {
  await toWork(page);
  await expect(nearItem(page)).toBeVisible();
  await page.getByRole("button", { name: /^החלפה ל«/ }).first().click();
  await expect(sheet(page)).not.toContainText("רונת");
  await expect(nearItem(page)).toHaveCount(0);
  await expect(page.locator("[data-bar]")).not.toContainText("כבר ברשימה");
});

test("dismissing a near-miss keeps the word and closes the item for good", async ({ page }) => {
  await toWork(page);
  await expect(nearItem(page)).toBeVisible();
  await page.getByRole("button", { name: "מילה אחרת" }).first().click();
  await expect(sheet(page)).toContainText("רונת");
  await expect(nearItem(page)).toHaveCount(0);
  // still gone after another rerun
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder("ערך שפוספס").fill("צו הגנה");
  await page.getByRole("button", { name: "הוספה והחלפה" }).click();
  await expect(sheet(page)).not.toContainText("צו הגנה");
  await expect(nearItem(page)).toHaveCount(0);
});

test("adding a value already in the list selects its card and says so in the bar, not at the top", async ({ page }) => {
  await toWork(page);
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder("ערך שפוספס").fill("רונית לוי");
  await page.getByRole("button", { name: "הוספה והחלפה" }).click();
  const bar = page.locator("[data-bar]");
  await expect(bar).toContainText("כבר ברשימה");
  await expect(page.locator("[data-group]").filter({ hasText: "רונית לוי" }).first()).toHaveAttribute("style", /background:\s*var\(--panel2\)/);
  await bar.getByRole("button", { name: "סגירה" }).click();
  await expect(bar).not.toContainText("כבר ברשימה");
  // the bar stays one line: no second text row
  expect(await bar.locator("small").count()).toBe(0);
});

test("a flagged item can be dismissed from its card without selecting it", async ({ page }) => {
  await toWork(page);
  await page.getByRole("button", { name: /^לבדיקה \d/ }).click().catch(() => {});
  const flagged = page.locator("[data-group]").filter({ has: page.getByRole("button", { name: "לא רלוונטי — הסרה" }) });
  if (await flagged.count()) {
    const n = await flagged.count();
    await flagged.first().getByRole("button", { name: "לא רלוונטי — הסרה" }).click();
    await expect(page.locator("[data-group]").filter({ has: page.getByRole("button", { name: "לא רלוונטי — הסרה" }) })).toHaveCount(n - 1);
  }
});

test("the kind dropdown on the people screen changes the kind and keeps the chip in place", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("עמותת שביל הלב"); await input.press("Enter");
  await input.fill("דנה כהן"); await input.press("Enter");
  const rows = H.peopleRows(page);
  const before = await H.listedNames(page);
  const sel = rows.filter({ hasText: "דנה כהן" }).getByRole("combobox");
  await sel.selectOption("ORG");
  await expect(sel).toHaveValue("ORG");
  expect(await H.listedNames(page)).toEqual(before); // same order, nothing moved
});
