const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* The case profile is the promise that the same person gets the same fake
   name in every document of a case. It used to live only as a file she had
   to remember to export. Now it is written to the browser after every
   change, offered on the next visit, and leaving without an export warns. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

test.beforeEach(async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
});

test("the profile survives a reload and is offered on the entry screen as a named case", async ({ page }) => {
  // name the case in the profile section
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("לוי נ׳ לוי");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("redact-profile-last") || "null"));
  expect(saved && saved.v).toBe(1);
  expect(saved.name).toBe("לוי נ׳ לוי");
  expect(saved.rules.map((r) => r.value)).toContain("רונית לוי");
  expect(saved.map["NAME|רונית לוי"] || Object.values(saved.map).length).toBeTruthy();

  // a fresh visit: the card names the case and one tap restores the rules
  await page.reload();
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  // a named case sits in the case list, not in the single-slot card
  const row = page.locator("[data-case=\"לוי נ׳ לוי\"]");
  await expect(row).toBeVisible();
  await expect(row).toContainText("ערכים");
  await row.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(page.locator("[data-case]")).toHaveCount(0);
  // the rules are back: uploading the same document pre-fills from the profile
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case2.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  expect(await H.listedNames(page)).toContain("רונית לוי");
});

test("leaving the work screen without an export asks first", async ({ page }) => {
  let asked = "";
  page.on("dialog", async (d) => { asked = d.message(); await d.dismiss(); });
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  expect(asked).toContain("לא יוצא לקובץ");
  await expect(page.locator("[data-mark]").first()).toBeVisible(); // still on the work screen
});
