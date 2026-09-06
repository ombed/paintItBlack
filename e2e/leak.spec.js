const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* A name that got through, marked by hand on the check screen, becomes a
   leak report: the shape of the miss, never the text. She copies it into
   an issue; bench/from-leak.js rebuilds a document from it. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהשכן קרבוטינסקי הגיע באיחור.\nהדיון התקיים ביום שלישי.";

test("marking a missed name records a shape with no text, and the copy carries none", async ({ page }) => {
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

  // the surname the tool missed is still in the text; select it and mark it as a name
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).toContainText("קרבוטינסקי");
  await page.evaluate(() => {
    const root = document.querySelector("[data-work] section");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) { const i = node.textContent.indexOf("קרבוטינסקי"); if (i >= 0) {
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + "קרבוטינסקי".length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      node.parentElement.closest("[onmouseup], div").dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); break; } }
  });
  const popup = page.locator("[data-popup]");
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "שם", exact: true }).click();
  await expect(sheet).not.toContainText("קרבוטינסקי");

  // the clean section shows the count and copies the report
  await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await expect(page.getByText("שמות שסימנת בעצמך: 1")).toBeVisible();
  await page.getByRole("button", { name: "העתקת דוח הדליפה" }).click();
  const copied = await page.evaluate(() => window.__copied || "");
  const rep = JSON.parse(copied);
  expect(rep.count).toBe(1);
  expect(rep.shapes[0].words).toBe(1);
  expect(rep.shapes[0].lens).toEqual([10]);
  expect(["definite", "common"]).toContain(rep.shapes[0].before); // "השכן": a class, never the word
  expect(copied).not.toContain("קרבוטינסקי");
  expect(copied).not.toContain("רונית");
  expect(/[֐-׿]{3,}/.test(copied)).toBe(false);
});
