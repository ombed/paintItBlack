const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* What discover finds but is not sure about used to vanish: the page read
   its candidates in one place, the auto-fill loop, and a medium-confidence
   one was neither shown nor asked about. A role word in running prose,
   "התובעת רונית לוי", is exactly that case. It now sits in a strip under
   the list: one tap adds, one tap dismisses. Model off, so the strip's
   contents came from discover alone. */

const DOC = "פרוטוקול\nהתובעת רונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

const strip = (page) => page.getByText("נמצאו גם", { exact: false });
const chip = (page, name) => page.getByRole("button", { name: "+ " + name, exact: true });

test.beforeEach(async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
});

test("a medium candidate is offered, not auto-filled, and one tap adds it", async ({ page }) => {
  expect(await H.listedNames(page)).not.toContain("רונית לוי");
  await expect(strip(page)).toBeVisible();
  await expect(chip(page, "רונית לוי")).toBeVisible();

  await chip(page, "רונית לוי").click();
  expect(await H.listedNames(page)).toContain("רונית לוי");
  await expect(H.peopleRows(page).filter({ hasText: "רונית לוי" }).locator("small")).toHaveText("מההקשר");
  // added means no longer offered
  await expect(chip(page, "רונית לוי")).toHaveCount(0);
  await expect(strip(page)).toHaveCount(0);
});

test("one tap dismisses a candidate that is not a person", async ({ page }) => {
  await expect(chip(page, "רונית לוי")).toBeVisible();
  await page.getByRole("button", { name: "לא אדם" }).first().click();
  await expect(chip(page, "רונית לוי")).toHaveCount(0);
  expect(await H.listedNames(page)).not.toContain("רונית לוי");
});
