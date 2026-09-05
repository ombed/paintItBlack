// Scratch walk-through for the UX review. Not a test: it captures every
// screen and state to a folder, with the model stubbed so states repeat.
const { test, expect } = require("@playwright/test");
const H = require("./helpers");
const fs = require("fs");
const path = require("path");

const OUT = process.env.AUDIT_OUT || path.join(__dirname, "..", "test-results", "audit");
fs.mkdirSync(OUT, { recursive: true });
const snap = async (page, name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
  fs.writeFileSync(path.join(OUT, name + ".txt"), await page.evaluate(() => document.body.innerText));
};

const DOC = [
  "פרוטוקול דיון — תיק 12345-06-24",
  "התובעת: רונית לוי, ת\"ז 123456782, טלפון 052-4471938",
  "הנתבע: אורי בן-שחר, מרחוב הרצל 15, חיפה",
  "רונית לוי הגישה בקשה לצו הגנה. הילדים לומדים בבית ספר ניצני הגליל ומטופלים בעמותת שביל הלב.",
  "אורי בן-שחר עבר לתל אביב, ואילו רונית נשארה בחיפה. גם רונת לוי הוזכרה בתצהיר.",
  "משרד הרווחה אישר את התסקיר. העו\"ס דנה כהן-לוי מסרה כי המשפחה ביקרה בבאר שבע.",
  "השופטת: הדיון נדחה. בן-שחר יגיש תצהיר.",
].join("\n");

test("walk every screen", async ({ page, browser }) => {
  test.setTimeout(300000);
  await H.serveEngineWithStub(page);

  // 1. intro overlay, first visit
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await snap(page, "01-intro");
  await page.getByRole("button", { name: /הבנתי/ }).click();
  await snap(page, "02-entry");

  // narrow + dark on the entry
  await page.setViewportSize({ width: 390, height: 844 });
  await snap(page, "02-entry-mobile");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();
  await snap(page, "02-entry-dark");
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();

  // 3. paste panel
  await page.getByPlaceholder(/הדבקת טקסט/).fill("ביום שלישי נסע יוסי כהן מחיפה לתל אביב.");
  await snap(page, "03-paste-filled");
  await page.getByPlaceholder(/הדבקת טקסט/).fill("");

  // 4. file pending
  await page.evaluate(() => {
    window.__ner = { delay: () => 1500, names: () => ["דנה כהן-לוי", "הגישה בקשה", "אורי בן-שחר", "הרווחה"] };
  });
  await H.upload(page, "תיק-לוי.docx", DOC);
  await snap(page, "04-entry-pending");

  // 5. people: scanning, then filled
  await H.startScan(page);
  await expect(H.scanning(page)).toBeVisible();
  await snap(page, "05-people-scanning");
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await snap(page, "06-people");
  await page.setViewportSize({ width: 390, height: 844 });
  await snap(page, "06-people-mobile");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();
  await snap(page, "06-people-dark");
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();

  // 6. places
  await H.goButton(page).click();
  await expect(page.getByRole("heading", { name: /יישובים/ })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(6000); // let the atlas arrive if it will
  await snap(page, "07-places");
  await page.setViewportSize({ width: 390, height: 844 });
  await snap(page, "07-places-mobile");
  await page.setViewportSize({ width: 1280, height: 900 });

  // 7. check screen
  const apply = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לעיבוד/ });
  await apply.first().click();
  await page.waitForTimeout(4000);
  await snap(page, "08-after-apply");
  const errs = []; page.on("pageerror", (e) => errs.push(e.message)); fs.writeFileSync(path.join(OUT, "08-pageerrors.txt"), errs.join("; "));
  // expand every rail section and capture
  for (const t of ["לבדיקה", "מה נמצא והוחלף", "החזרת שמות מתשובת ה-AI", "הרשימה ופרופיל התיק", "מה נוקה מהקובץ"]) {
    const h = page.getByText(t, { exact: false }).first(); if (await h.count()) await h.click();
  }
  await page.waitForTimeout(400);
  await snap(page, "08-check-expanded");
  // one section at a time: the accordion closes the others
  for (const [t, n] of [["לבדיקה", "13-review-open"], ["מה נמצא והוחלף", "14-found-open"], ["החזרת שמות מתשובת ה-AI", "15-ai-open"], ["הרשימה ופרופיל התיק", "16-profile-open"]]) {
    const h = page.getByText(t, { exact: false }).first(); if (await h.count()) { await h.click(); await page.waitForTimeout(400); await snap(page, n); }
  }
  // click a replaced mark in the document
  const mark = page.locator("[data-mark]").first(); if (await mark.count()) { await mark.click(); await page.waitForTimeout(400); await snap(page, "09-check-mark-clicked"); }
  // the source view
  const src = page.getByRole("button", { name: "מקור", exact: true }); if (await src.count()) { await src.click(); await page.waitForTimeout(300); await snap(page, "09-check-source"); }
  // phone width: the two panes become tabs
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await snap(page, "09-check-mobile-doc");
  const tab = page.getByRole("button", { name: "ממצאים ובדיקה" }); if (await tab.count()) { await tab.click(); await page.waitForTimeout(400); await snap(page, "09-check-mobile-findings"); }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();
  await page.waitForTimeout(300);
  await snap(page, "08-check-dark");
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();
  // 8. reverse
  await page.getByRole("button", { name: /החזרת שמות מתשובת AI/ }).click();
  await expect(page.getByPlaceholder("הדבקת תשובת ה-AI…")).toBeVisible();
  await snap(page, "10-reverse-empty");
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill("להערכתי, פלוני א׳ צריך להגיש את התצהיר עד יום ראשון.");
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await page.waitForTimeout(500);
  await snap(page, "11-reverse-result");

  // 9. model failure on a fresh page
  const p2 = await browser.newPage();
  await H.serveEngineWithStub(p2);
  await H.boot(p2);
  await p2.evaluate(() => { window.__ner = { error: "הרשת חסומה" }; });
  await H.upload(p2, "תיק.docx", DOC);
  await H.startScan(p2);
  await expect(H.goButton(p2)).toBeVisible({ timeout: 10000 });
  await snap(p2, "12-people-model-failed");
  await p2.close();
});
