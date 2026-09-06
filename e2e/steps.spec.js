const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* The round trip is her daily task: redact, send to the AI, put the real
   names back into what comes back. Restore used to be a header link. It is
   now step three, offered in the bar the moment step two (copy) happens,
   and the restore screen arrives already connected to this document. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

test("copying unlocks step three, and the restore screen puts the real name back", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });

  const bar = page.locator("[data-bar]");
  await expect(bar.locator("[data-steps]")).toContainText("2 העתקה ל-AI");
  await expect(bar.getByRole("button", { name: "הדבקת תשובת ה-AI" })).toHaveCount(0);

  await bar.getByRole("button", { name: /העתקה ל-AI|הועתק/ }).click();
  const copied = await page.evaluate(() => window.__copied || "");
  expect(copied).not.toContain("רונית לוי");
  const fake = copied.match(/[֐-׿]+ [֐-׿]+ הגישה/); // "<fake first> <fake last> הגישה"
  expect(fake).toBeTruthy();
  const fakeName = fake[0].replace(" הגישה", "");
  await expect(bar.locator("[data-steps]")).toContainText("2 העתקה ל-AI ✓");
  const step3 = bar.getByRole("button", { name: "הדבקת תשובת ה-AI" });
  await expect(step3).toBeVisible();

  // step three: the AI's answer comes back with the fake name; the real one returns
  await step3.click();
  await expect(page.getByText("מחובר למסמך שבעבודה")).toBeVisible();
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill("להערכתי, " + fakeName + " צריכה להגיש את התצהיר עד יום ראשון.");
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("main")).toContainText("רונית לוי צריכה להגיש");
});
