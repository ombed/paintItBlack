const { test, expect } = require("./base");
const H = require("./helpers");

/* The restore screen («החזרת שמות מתשובת AI»), from the live check of 6.10. */

// two people who each speak twice, so the list fills without the model
const DOC = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח.",
  "דוד כהן: אני המשיב.",
  "רחל פרידמן: תודה.",
  "דוד כהן: נסכם בכתב.",
].join("\n");

// on a phone the settings, and the model switch with them, sit behind a toggle
async function modelOff(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
}

// from a loaded document to the review screen; the places screen comes when the document has towns
async function toWork(page) {
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}

async function firstDoc(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  await H.upload(page, "case.docx", DOC);
  await toWork(page);
}

const fakeOf = async (page, real) => (await page.locator(`[data-mark][data-val="${real}"]`).first().innerText()).trim();
const openRestore = (page) => page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();

async function restore(page, answer) {
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(answer);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("[data-rv-out]")).toBeVisible();
}

/* Each paragraph of the restored answer as laid out: the edge it hugs, and whether its closing
   mark sits to the left of its first letter (read right to left) or to its right. */
const paragraphs = (page) => page.locator("[data-rv-out]").evaluate((out) => {
  const walker = document.createTreeWalker(out, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let full = "", n;
  while ((n = walker.nextNode())) { nodes.push({ n, at: full.length }); full += n.data; }
  const pos = (i) => { for (let k = nodes.length - 1; k >= 0; k--) if (i >= nodes[k].at) return [nodes[k].n, i - nodes[k].at]; return [nodes[0].n, 0]; };
  const rects = (s, e) => { const r = document.createRange(); r.setStart(...pos(s)); r.setEnd(...pos(e)); return [...r.getClientRects()].filter((q) => q.width > 0); };
  const cs = getComputedStyle(out), box = out.getBoundingClientRect();
  const left = box.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
  const right = box.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
  const res = [];
  let i = 0;
  for (const line of full.split("\n")) {
    const s = i, e = i + line.length;
    i = e + 1;
    if (!line.trim()) continue;
    const rs = rects(s, e);
    const L = Math.min(...rs.map((q) => q.left)), R = Math.max(...rs.map((q) => q.right));
    const f = s + line.search(/\S/), first = rects(f, f + 1)[0], last = rects(e - 1, e)[0];
    res.push({
      line,
      lines: new Set(rs.map((q) => Math.round(q.top))).size,
      hugs: right - R <= 2 && L - left > 2 ? "right" : L - left <= 2 && right - R > 2 ? "left" : "both",
      markLeftOfStart: last.right <= first.left + 1,
    });
  }
  return res;
});

for (const size of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }]) {
  test.describe(`at ${size.name} size`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    /* Live check, 6.10: the result was one block with dir="auto", so an answer that opened with a Latin
       letter («Sure!», «Summary:», a ``` fence) laid every Hebrew paragraph out left to right, with its
       full stop on the wrong side. Each paragraph now takes its direction from its own first letter,
       as the paste box above it does, inside a box that is right to left. */
    test("each paragraph of the restored answer reads in its own direction", async ({ page }) => {
      await firstDoc(page);
      const r = await fakeOf(page, "רחל פרידמן"), d = await fakeOf(page, "דוד כהן");
      await openRestore(page);

      // an answer that opens in English
      await restore(page, ["Sure! Here is a summary:", `${r} היא המבקשת.`, `${d} הוא המשיב.`, "Both agree."].join("\n"));
      await expect(page.locator("[data-rv-out]")).toContainText("רחל פרידמן היא המבקשת.");
      let got = await paragraphs(page);
      expect(got.map((p) => p.lines), "each paragraph fits one line, so the edge it hugs says its direction").toEqual([1, 1, 1, 1]);
      expect(got.map((p) => [p.line, p.hugs, p.markLeftOfStart])).toEqual([
        ["Sure! Here is a summary:", "left", false],
        ["רחל פרידמן היא המבקשת.", "right", true],
        ["דוד כהן הוא המשיב.", "right", true],
        ["Both agree.", "left", false],
      ]);

      // an answer that opens in Hebrew, with an English line inside
      await restore(page, [`${d} הוא המשיב.`, "Note: see the protocol.", `${r} היא המבקשת.`].join("\n"));
      await expect(page.locator("[data-rv-out]")).toContainText("דוד כהן הוא המשיב.");
      got = await paragraphs(page);
      expect(got.map((p) => [p.line, p.hugs, p.markLeftOfStart])).toEqual([
        ["דוד כהן הוא המשיב.", "right", true],
        ["Note: see the protocol.", "left", false],
        ["רחל פרידמן היא המבקשת.", "right", true],
      ]);
    });
  });
}

// a first document with two towns, so the places screen writes rules; the next one has neither its people nor its towns
const WITH_TOWNS = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח. גרנו בחיפה ואחר כך בתל אביב.",
  "דוד כהן: הגעתי מחיפה הבוקר.",
  "רחל פרידמן: תודה.",
  "דוד כהן: נסכם בכתב.",
].join("\n");
const NEXT = [
  "פרוטוקול ישיבה",
  "יעל ברגר: אני המבקשת.",
  "משה גולן: אני המשיב.",
  "יעל ברגר: אני מבקשת דחייה.",
  "משה גולן: אני מתנגד.",
].join("\n");

/* Live check, 6.10: «מסמך חדש» cleared the restore screen, but the next document can also be reached by the
   back buttons and loaded from there. Then the last client's AI answer and its restored real names waited on
   the restore screen of the next one, and the restore still read the last document's mapping: its towns and
   the pseudonyms it had sent came back as that client's real ones. Loading a document, by pasted text or by a
   file, now clears all of it; a case that is attached keeps its own (e2e/qa2.spec.js, e2e/unruly.spec.js). */
for (const how of ["pasted text", "a file"]) {
  test(`the next document, loaded by ${how}, finds nothing of the last one on the restore screen`, async ({ page }) => {
    await H.serveEngineWithStub(page);
    await H.boot(page);
    await modelOff(page);
    await H.upload(page, "first.docx", WITH_TOWNS);
    await toWork(page);
    const r = await fakeOf(page, "רחל פרידמן");
    const town = await page.evaluate(() => (window.__pib.state().rules.find((x) => x.value === "חיפה") || {}).replacement);
    expect(town, "the first document's town has a pseudonym").toBeTruthy();
    // copied, so its pseudonyms count as sent
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
    await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
    const anyway = page.getByRole("button", { name: /בכל זאת/ });
    if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
    await openRestore(page);
    await restore(page, `${r} גרה ב${town}.`);
    await expect(page.locator("[data-rv-out]")).toHaveText("רחל פרידמן גרה בחיפה.");

    // back to the file screen by the back buttons, not by «מסמך חדש»
    for (const label of ["חזרה למסמך", "מי בתיק", "קובץ"]) {
      await expect(page.locator("[data-back]")).toContainText(label);
      await page.locator("[data-back]").click();
    }
    if (how === "pasted text") {
      await page.getByPlaceholder("הדבקת טקסט לבדיקה…").fill(NEXT);
      await page.getByRole("button", { name: "שימוש בטקסט הזה" }).click();
    } else await H.upload(page, "next.docx", NEXT);
    await toWork(page);
    const y = await fakeOf(page, "יעל ברגר");

    await openRestore(page);
    await expect(page.getByPlaceholder("הדבקת תשובת ה-AI…")).toHaveValue("");
    await expect(page.locator("[data-rv-out]")).toHaveCount(0);
    await expect(page.locator("[data-rv-result]")).toHaveCount(0);
    // this document's names come back; the last one's pseudonyms are not this client's, and stay as written
    await restore(page, `${y} ביקשה דחייה. ${r} גרה ב${town}.`);
    const out = page.locator("[data-rv-out]");
    await expect(out).toContainText("יעל ברגר ביקשה דחייה.");
    await expect(out).toContainText(`גרה ב${town}.`);
    await expect(out).not.toContainText("רחל פרידמן");
    await expect(out).not.toContainText("חיפה");
  });
}

/* Live check, 6.10: after «החזרת שמות» a screen reader heard nothing, whether it worked or failed: neither
   the error nor the result's heading sat in a live region, and the focus stayed on the button. The error
   is an alert now, as on the other screens, and the heading sits in a status region that is on the screen
   before the result comes, so the result is announced when it arrives; the heading stays a heading. */
test("a screen reader is told the restore's error and its result", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  // no document and no case: the error
  await openRestore(page);
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill("אביבה ביטון היא האם.");
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("עדיין אין שמות להחזרה");

  // with a document: the result
  await page.locator("[data-back]").click();
  await H.upload(page, "case.docx", DOC);
  await toWork(page);
  const r = await fakeOf(page, "רחל פרידמן");
  await openRestore(page);
  const status = page.locator("main").getByRole("status");
  await expect(status, "the status region is there before the result").toHaveCount(1);
  await expect(status).toHaveText("");
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(`${r} היא המבקשת.`);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toContainText("התשובה עם השמות האמיתיים · שם אחד הוחזר");
  await expect(status.getByRole("heading", { name: /התשובה עם השמות האמיתיים/ })).toBeVisible();
  await expect(page.locator("[data-rv-out]")).toHaveText("רחל פרידמן היא המבקשת.");
});

/* The independent review of 6.10: a second restore with the same count left the status region's text as
   it was, and a live region that does not change says nothing, so the second restore was not said; nor
   was the same error a second time. Each restore now puts its heading and its alert back as new elements,
   which a screen reader reads as new. Checked by identity: the element of the first restore is gone. */
test("a second restore is said again, with the same result and with the same error", async ({ page }) => {
  await firstDoc(page);
  const r = await fakeOf(page, "רחל פרידמן");
  await openRestore(page);
  const status = page.locator("main").getByRole("status");
  const mark = (loc) => loc.evaluate((el) => { el.__said = true; });
  const same = (loc) => loc.evaluate((el) => !!el.__said);

  await restore(page, `${r} היא המבקשת.`);
  const head = status.locator("[data-rv-result]");
  await expect(head).toHaveText("התשובה עם השמות האמיתיים · שם אחד הוחזר");
  await mark(head);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(head).toHaveText("התשובה עם השמות האמיתיים · שם אחד הוחזר");
  await expect.poll(() => same(head), { message: "the same result is put back as a new heading" }).toBe(false);

  // an answer with no pseudonym in it, twice
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill("אין כאן אף שם.");
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("לא נמצא בתשובה אף שם בדוי");
  await mark(alert);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(alert).toContainText("לא נמצא בתשובה אף שם בדוי");
  await expect.poll(() => same(alert), { message: "the same error is put back as a new alert" }).toBe(false);
});
