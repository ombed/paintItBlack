const { test, expect } = require("./base");
const H = require("./helpers");

/* The next document, however it is loaded, starts from nothing of the last one (the independent review of
   6.10). «מסמך חדש» cleared about fifty keys, and a document loaded after the back buttons cleared eight:
   the people screen, the places, the suggestions, the decisions and the last scan of the first document
   were all still there for the second one. One reset now serves «מסמך חדש» and every way of loading a
   document; tests/state_t.js keeps the two from drifting apart again. */

// two people who each speak twice, so the list fills without the model
const FIRST = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח.",
  "דוד כהן: אני המשיב.",
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

// on a phone the settings, and the model switch with them, sit behind a toggle
async function modelOff(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
}

// from the people screen to the review screen; the places screen comes when the document has towns
async function listToWork(page) {
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(bar).toBeVisible({ timeout: 20000 });
}
async function toWork(page) {
  await H.startScan(page);
  await listToWork(page);
}

const backTo = async (page, labels) => {
  for (const label of labels) {
    await expect(page.locator("[data-back]")).toContainText(label);
    await page.locator("[data-back]").click();
  }
};
const step = (page, name) => page.locator("header nav").getByRole("button", { name, exact: true });
const sheetText = (page) => page.locator("[data-work] section").first().innerText();

/* The reviewer's walk: a first document with two people, back to the file screen by «רשימת השמות» and
   «קובץ», a second document with two other people, and the header's «מי בתיק». The people screen listed
   the FIRST document's people, «המשך» applied them, and the second document's names stayed in the text.
   The same through «מקומות», which went to the places screen with the first document's rules. A header
   step now leads to this document's own list: it is built first, as «המשך — איתור שמות במסמך» does. */
for (const via of ["מי בתיק", "יישובים"]) {
  test(`the next document loaded after the back buttons gets its own list from the header's «${via}»`, async ({ page }) => {
    await H.serveEngineWithStub(page);
    await H.boot(page);
    await modelOff(page);
    await H.upload(page, "first.docx", FIRST);
    await toWork(page);
    await backTo(page, ["מי בתיק", "קובץ"]);
    await H.upload(page, "next.docx", NEXT);

    // nothing of the first document waits in the state of the second
    const left = await page.evaluate(() => {
      const s = window.__pib.state();
      return { peo: s.peo, peoSug: s.peoSug, peoKept: s.peoKept, cands: s.cands, approved: s.approved, peoNotSame: s.peoNotSame,
        geo: s.geo, geoNames: s.geoNames, geoExtra: s.geoExtra, geoEdits: s.geoEdits, notice: s.notice || "", rules: s.rules, res: s.res };
    });
    expect(left).toEqual({ peo: [], peoSug: [], peoKept: [], cands: [], approved: [], peoNotSame: [],
      geo: null, geoNames: [], geoExtra: [], geoEdits: {}, notice: "", rules: [], res: null });

    await step(page, via).click();
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    const names = await H.listedNames(page);
    expect(names).toEqual(expect.arrayContaining(["יעל ברגר", "משה גולן"]));
    expect(names).not.toContain("רחל פרידמן");
    expect(names).not.toContain("דוד כהן");

    await listToWork(page);
    const text = await sheetText(page);
    expect(text).not.toContain("יעל ברגר");
    expect(text).not.toContain("משה גולן");
    const rules = await page.evaluate(() => window.__pib.state().rules.map((r) => r.value));
    expect(rules).toEqual(expect.arrayContaining(["יעל ברגר", "משה גולן"]));
    expect(rules).not.toContain("רחל פרידמן");
    expect(rules).not.toContain("דוד כהן");
  });
}

/* The same class, later: the first document's model went on scanning after «לא לחכות למודל», and its
   answer came back while the second document was open. It was written into the second document's rules
   («מסמך חדש» and the back buttons alike), and the second document was processed again with the first
   client's name in it. The reset ends the last document's scan with it. */
for (const how of ["«מסמך חדש»", "the back buttons"]) {
  test(`a model still scanning the last document writes nothing into the next one, after ${how}`, async ({ page }) => {
    await H.serveEngineWithStub(page);
    await H.boot(page);
    // only the first document's scan finds a name, and only late
    await page.evaluate(() => {
      window.__ner = {
        delay: (t) => (t.includes("רחל פרידמן") ? 6000 : 0),
        names: (t) => { window.__nerDone = (window.__nerDone || 0) + 1; return t.includes("רחל פרידמן") ? ["שמעון ביטון"] : []; },
        n: () => 2,
      };
    });
    await H.upload(page, "first.docx", FIRST + "\nהעד שמעון ביטון לא הגיע. שמעון ביטון יוזמן שוב.");
    await H.startScan(page);
    await page.getByRole("button", { name: /לא לחכות למודל/ }).click();
    await listToWork(page);

    if (how === "«מסמך חדש»") {
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "מסמך חדש", exact: true }).click();
    } else await backTo(page, ["מי בתיק", "קובץ"]);
    await modelOff(page);
    await H.upload(page, "next.docx", NEXT);
    await toWork(page);
    await expect(page.locator('[data-mark][data-val="יעל ברגר"]').first()).toBeVisible();

    // the first document's scan answers now, while the second one is on the screen
    await page.waitForFunction(() => window.__nerDone >= 1, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    const now = await page.evaluate(() => {
      const s = window.__pib.state();
      return { rules: s.rules.map((r) => r.value), suggest: ((s.res && s.res.verification.suggest) || []).map((x) => x.value) };
    });
    expect(now.rules).not.toContain("שמעון ביטון");
    expect(now.suggest).not.toContain("שמעון ביטון");
    expect(await page.locator("[data-work]").innerText()).not.toContain("שמעון ביטון");
  });
}

/* The hosted service defines docEnd(how): when a document ends, it sends that document's usage log and its
   report of missed names, and the session log's "new-doc" is where scripts/log-report.js splits documents.
   Only «מסמך חדש» called it, so the next document loaded through the back buttons (or the tour started over
   an open one) would drop the report and merge two documents in the log. The reset ends the document that
   was open, once, before its data is cleared. The public tool has no docEnd of its own: the stand-in here
   is installed before the page loads, where the component finds it as this.docEnd. The hosted branch has its
   own docEnd, which hides that stand-in and hands the document to window.__inkHost.docEnd (cloud.js on the
   site), so a stand-in __inkHost records those calls, reading the ending document from the test hook. */
async function fakeDocEnd(page) {
  await page.addInitScript(() => {
    window.__ends = [];
    Object.defineProperty(Object.prototype, "docEnd", {
      configurable: true, writable: true, enumerable: false,
      value: function (how) { window.__ends.push({ how, name: this.state.name, res: !!this.state.res }); },
    });
    window.__inkHost = { docEnd: (p) => { const s = (window.__pib && window.__pib.state()) || {}; window.__ends.push({ how: p.how, name: s.name, res: !!s.res }); } };
  });
}
const ends = (page) => page.evaluate(() => window.__ends);
const newDocs = (page) => page.evaluate(() => window.__pib.log().events.filter((e) => e.ev === "new-doc").length);

test("the document that ends calls docEnd once, by the back buttons and by «מסמך חדש»", async ({ page }) => {
  await fakeDocEnd(page);
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  await H.upload(page, "first.docx", FIRST);
  await toWork(page);
  expect(await ends(page)).toEqual([]);

  // the back buttons and the next file: the first document ends, once, while its result is still there
  await backTo(page, ["מי בתיק", "קובץ"]);
  expect(await ends(page)).toEqual([]);
  await H.upload(page, "next.docx", NEXT);
  expect(await ends(page)).toEqual([{ how: "new-doc", name: "first.docx", res: true }]);
  expect(await newDocs(page)).toBe(1);

  // «מסמך חדש» on the second: once more, not twice
  await toWork(page);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש", exact: true }).click();
  await expect(page.getByRole("heading", { name: /להיעזר ב־AI בלי לחשוף את הלקוח/ })).toBeVisible();
  expect(await ends(page)).toEqual([{ how: "new-doc", name: "first.docx", res: true }, { how: "new-doc", name: "next.docx", res: true }]);
  expect(await newDocs(page)).toBe(2);

  // nothing was open after «מסמך חדש», so the next file ends nothing
  await H.upload(page, "third.docx", FIRST);
  expect((await ends(page)).length).toBe(2);
  expect(await newDocs(page)).toBe(2);
});

test("the tour started over an open document ends it once, and the tour's own sample ends nothing", async ({ page }) => {
  await fakeDocEnd(page);
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  await H.upload(page, "first.docx", FIRST);
  await toWork(page);
  await backTo(page, ["מי בתיק", "קובץ"]);

  await page.locator("[data-tour-start]").click();
  const tour = page.locator("[data-tour]");
  await expect(tour).toContainText("קובץ או טקסט");
  expect(await ends(page)).toEqual([{ how: "new-doc", name: "first.docx", res: true }]);
  expect(await newDocs(page)).toBe(1);
  // the sample is loaded and the tour closed: no document of hers ended there
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await tour.getByRole("button", { name: "סגירת הסיור" }).click();
  await expect(tour).toHaveCount(0);
  await H.upload(page, "next.docx", NEXT);
  expect((await ends(page)).length).toBe(1);
  expect(await newDocs(page)).toBe(1);
});
