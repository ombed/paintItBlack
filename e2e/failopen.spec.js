const { test, expect } = require("./base");
const H = require("./helpers");

/* A layer that breaks must not look like a layer that found nothing (outside review, M25).
   The engine is broken on purpose by appending to it; the Node side of the same class is
   tests/failopen_t.js. */

const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");

async function toWork(page, engineTail, model) {
  await H.serveEngineWithStub(page);
  if (engineTail) {
    await page.route("**/redact-engine.js", async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) + "\n" + engineTail, headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" } });
    });
  }
  await H.boot(page);
  if (model) await page.evaluate((m) => { window.__ner = { names: () => m.names, failedChunks: m.failedChunks, chunks: m.chunks }; }, model);
  else await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("a body scan that throws turns the bar red, not green, and export asks first", async ({ page }) => {
  await toWork(page, `bodyNames = function () { throw new Error("broken on purpose"); };`);
  const bar = page.locator("[data-bar-text]");
  await expect(bar).toContainText("הבדיקה האחרונה לא הושלמה");
  await expect(bar).toContainText("החיפוש אחר שמות שלא ברשימה נכשל באמצע");
  await page.getByRole("button", { name: "הורדת Word" }).click();
  await expect(page.locator("[data-export-ask]")).toContainText("ייתכנו שמות שלא הוצעו לך");
  // and it still lets her take the file, knowingly
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "להוריד בכל זאת" }).click();
  await dl;
});

test("the same document with every layer working is green", async ({ page }) => {
  await toWork(page);
  await expect(page.locator("[data-bar-text]")).not.toContainText("לא הושלמה");
});

test("a model that could not read part of the document says so", async ({ page }) => {
  await toWork(page, null, { names: ["רחל פרידמן", "אבנר שטרן"], failedChunks: 2, chunks: 9 });
  await expect(page.locator("[data-notice]")).toContainText("המודל לא הצליח לקרוא 2 מתוך 9 קטעים");
});
