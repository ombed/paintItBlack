const { test, expect } = require("./base");
const H = require("./helpers");

/* A name that got through, marked by hand on the check screen, becomes a
   leak report: the shape of the miss, never the text. She copies it into
   an issue; bench/from-leak.js rebuilds a document from it. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהשכן קרבוטינסקי הגיע באיחור.\nהדיון התקיים ביום שלישי.";

async function toCheck(page, doc) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
}

// select the word in the document and mark it as a person, the way she does
async function markByHand(page, word) {
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).toContainText(word);
  await page.evaluate((w) => {
    const root = document.querySelector("[data-work] section");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) { const i = node.textContent.indexOf(w); if (i >= 0) {
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + w.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      node.parentElement.closest("[onmouseup], div").dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); break; } }
  }, word);
  const popup = page.locator("[data-popup]");
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "אדם", exact: true }).click();
  await expect(sheet).not.toContainText(word);
}

async function copiedReport(page) {
  const open = page.getByRole("button", { name: "העתקת דוח הדליפה" });
  if (!(await open.isVisible().catch(() => false))) await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await open.click();
  return page.evaluate(() => window.__copied || "");
}

test("marking a missed name records a shape with no text, and the copy carries none", async ({ page }) => {
  await toCheck(page, DOC);
  await markByHand(page, "קרבוטינסקי");

  // the clean section shows the count and copies the report
  await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await expect(page.getByText("שמות שסימנת בעצמך: 1")).toBeVisible();
  const copied = await copiedReport(page);
  const rep = JSON.parse(copied);
  expect(rep.count).toBe(1);
  expect(rep.shapes[0].words).toBe(1);
  expect(rep.shapes[0].lens).toEqual([10]);
  expect(["definite", "common"]).toContain(rep.shapes[0].before); // "השכן": a class, never the word
  expect(copied).not.toContain("קרבוטינסקי");
  expect(copied).not.toContain("רונית");
  expect(/[֐-׿]{3,}/.test(copied)).toBe(false);
});

/* Review C1: the space between the marked name and its neighbour was exported as it
   stood, and it is exactly where an ID number, a phone or an email sits. The old check
   looked for Hebrew only, so none of these could trip it. */
test("an ID, a phone and an email next to the marked name never reach the report", async ({ page }) => {
  // ID and phone checks are switched off, so the identifiers are still in the text she marks beside
  await toCheck(page, [
    "פרוטוקול דיון",
    "הקטינה קרבוטינסקי (205549611, ילידת 2014) נכחה.",
    "כתבו אל oleg.ivanov77@mail.ru. וסילייבסקי השיב בו ביום.",
    "טלפון 0526613874 ברקוביצקי ענה.",
  ].join("\n"));
  for (const w of ["קרבוטינסקי", "וסילייבסקי", "ברקוביצקי"]) {
    // the ID and phone may have been replaced by now; the report is built from the original document
    await markByHand(page, w);
  }
  const copied = await copiedReport(page);
  for (const s of ["205549611", "oleg", "ivanov", "mail.ru", "0526613874", "2014"]) expect(copied, s).not.toContain(s);
  const rep = JSON.parse(copied);
  expect(rep.count).toBe(3);
  expect(rep.refused).toBeUndefined();
  const gaps = rep.shapes.flatMap((s) => [s.gapBefore, s.gapAfter]).filter(Boolean);
  // a gap is punctuation from a short list, or a class with a length: never the characters themselves
  for (const g of gaps) expect(g).toMatch(/^(?:[,.;:!?()[\]"'׳״/–—-]{1,3}|email|(?:digits|latin|mixed)\(\d{1,3}\))$/);
  expect(gaps.some((g) => /^digits\(/.test(g))).toBe(true);
  expect(gaps).toContain("email");
});
