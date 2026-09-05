const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Port of tests/ui.js. That file dumped the presence of forty-odd vanilla
   element ids; none exist here, and ids are the disposable part. The intent
   survives: each screen renders the controls a user needs, and reaching
   them throws no page errors. */

test("each screen renders its controls, with no page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await H.serveEngineWithStub(page);
  await H.boot(page);

  // Entry: the two inputs, the four options, the chrome.
  await expect(page.getByRole("heading", { name: /מה יוצא מהמסמך/ })).toBeVisible();
  await expect(page.getByText("בחירת קובץ")).toBeVisible();
  await expect(page.getByText("הדבקת טקסט")).toBeVisible();
  await expect(page.locator('input[type="file"][accept*=".docx"]')).toHaveCount(1);
  await expect(page.locator('input[type="file"][accept*=".json"]')).toHaveCount(1);
  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(4);
  for (let i = 0; i < 4; i++) await expect(boxes.nth(i)).toBeEnabled();
  await expect(page.getByRole("button", { name: /החזרת שמות מתשובת AI/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "מצב יום או לילה" })).toBeVisible();
  await expect(page.locator("#ver")).toHaveText(/גרסה v\d+/);

  // People, reached through a real scan against the stubbed model.
  await page.evaluate(() => { window.__ner = { names: () => ["דנה לוי"] }; });
  await H.upload(page, "doc.docx", "דנה לוי הגישה בקשה.");
  await H.startScan(page);
  await expect(page.getByRole("heading", { name: /מי מופיע בתיק/ })).toBeVisible();
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(page.getByPlaceholder(/שם מלא/)).toBeVisible();
  await expect(page.getByRole("button", { name: "הוספה", exact: true })).toBeVisible();
  await expect(H.skipButton(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /טעינת פרופיל/ })).toBeVisible();
  for (const step of ["קובץ", "מי בתיק", "מקומות"])
    await expect(page.getByRole("button", { name: step, exact: true })).toBeVisible();
  expect(await H.listedNames(page)).toContain("דנה לוי");

  // Reverse: paste box and its action.
  await page.getByRole("button", { name: /החזרת שמות מתשובת AI/ }).click();
  await expect(page.getByRole("heading", { name: /החזרת שמות לתשובה/ })).toBeVisible();
  await expect(page.getByPlaceholder("הדבקת תשובת ה-AI…")).toBeVisible();
  await expect(page.getByRole("button", { name: "החזרת שמות", exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});
