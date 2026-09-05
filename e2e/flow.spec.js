const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Port of tests/flow.js, the largest of the four UI suites. It covers the
   entry and people screens: what auto-fills from the header, how typed and
   pasted names are cleaned and split, what happens when the model fails to
   load, what the user is told about the model in each environment, and the
   tokenizer regex repair. These are the first things she touches, and each
   is a place where a wrong guess silently changes what gets replaced.

   The model layer is stubbed through window.__ner; see helpers.js. The
   header detection, cleanEntry, the paste splitter and the fallback path
   are all the shipped code. */

// discover anchors a name on a role word only when a colon follows it, so
// "התובעת: רונית לוי" rates high and "התובעת רונית לוי" rates nothing.
const CASE = "פרוטוקול דיון — התובעת: רונית לוי\nהנתבע: גולדשמיט\nהדיון התקיים ביום שלישי.";

test.describe("people screen", () => {
  test.beforeEach(async ({ page }) => {
    await H.serveEngineWithStub(page);
    await H.boot(page);
    await page.evaluate(() => { window.__ner = { names: () => [] }; });
  });

  test("from the header, only a full name auto-fills, and the chip says where it came from", async ({ page }) => {
    await H.upload(page, "case.docx", CASE);
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    const names = await H.listedNames(page);
    expect(names).toContain("רונית לוי");
    expect(names).not.toContain("גולדשמיט"); // a lone surname is not a full name
    await expect(page.getByText("מהכותרת")).toBeVisible();
  });

  test("typed and pasted names: add, clear, dedupe, strip titles, detect orgs, split lists, delete, empty", async ({ page }) => {
    await H.upload(page, "plain.docx", "הדיון התקיים ביום שלישי.");
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    const input = page.getByPlaceholder(/שם מלא/);
    const add = page.getByRole("button", { name: "הוספה", exact: true });
    const rows = H.peopleRows(page);

    await input.fill("ברקוביץ");
    await add.click();
    expect(await H.listedNames(page)).toEqual(["ברקוביץ"]);
    await expect(input).toHaveValue("");            // the field clears

    await input.fill("ברקוביץ");
    await add.click();
    expect(await H.listedNames(page)).toEqual(["ברקוביץ"]); // duplicates are blocked

    // A title is stripped, and the chip records which one.
    await input.fill('עו"ד דנה פרידמן');
    await input.press("Enter");
    expect(await H.listedNames(page)).toContain("דנה פרידמן");
    await expect(page.getByText(/בלי «עו"ד»/)).toBeVisible();

    // An org prefix sets the kind, shown on the chip's kind button.
    await input.fill("עמותת פנים מאירות");
    await add.click();
    await expect(rows.filter({ hasText: "פנים מאירות" }).getByRole("button", { name: "גוף", exact: true })).toBeVisible();

    // Pasting a list splits on newlines and commas.
    await input.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData("text", "סיגלית אזולאי\nיוסי כהן, ח'טיב");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    let names = await H.listedNames(page);
    for (const n of ["סיגלית אזולאי", "יוסי כהן", "ח'טיב"]) expect(names).toContain(n);
    expect(names).toHaveLength(6);

    await rows.filter({ hasText: "ברקוביץ" }).getByRole("button", { name: "הסרה" }).click();
    names = await H.listedNames(page);
    expect(names).not.toContain("ברקוביץ");
    expect(names).toHaveLength(5);

    while ((await rows.count()) > 0) await rows.first().getByRole("button", { name: "הסרה" }).click();
    await expect(page.getByText(/הרשימה ריקה/)).toBeVisible();
  });

  test("when the model fails to load, the header list survives and the user is told", async ({ page }) => {
    await page.evaluate(() => { window.__ner = { error: "הרשת חסומה" }; });
    await H.upload(page, "case.docx", CASE);
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/המודל לא נטען/)).toBeVisible();
    expect(await H.listedNames(page)).toContain("רונית לוי");
    await expect(page.getByText(/טוען את המודל|סורק את המסמך/)).toHaveCount(0); // progress box closed
  });

  test("with the model switched off, no scan runs and no progress box appears", async ({ page }) => {
    await page.getByRole("checkbox").first().uncheck();
    await H.upload(page, "case.docx", CASE);
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    expect(await H.listedNames(page)).toContain("רונית לוי");
    expect(await page.evaluate(() => window.__nerCalls || 0)).toBe(0);
    await expect(page.getByText(/טוען את המודל|סורק את המסמך/)).toHaveCount(0);
  });
});

test.describe("what the user is told about the model", () => {
  test("from a local file the switch is locked, off, and explained", async ({ page }) => {
    await H.serveEngineWithStub(page);
    await page.addInitScript(() => { window.__ner = { env: { local: true, canCache: false, canRun: false } }; });
    await H.boot(page);
    const box = page.getByRole("checkbox").first();
    await expect(box).toBeDisabled();
    await expect(box).not.toBeChecked();
    await expect(page.getByText(/מקובץ מקומי המודל לא נטען/)).toBeVisible();
  });

  test("over http with the model cached, no download is promised", async ({ page }) => {
    await H.serveEngineWithStub(page);
    await page.addInitScript(() => { window.__ner = { env: { local: false, canCache: true, canRun: true }, cached: true }; });
    await H.boot(page);
    await expect(page.getByRole("checkbox").first()).toBeEnabled();
    await expect(page.getByText(/המודל שמור במחשב/)).toBeVisible();
  });

  test("over http without the model cached, the size of the download is stated", async ({ page }) => {
    await H.serveEngineWithStub(page);
    await page.addInitScript(() => { window.__ner = { env: { local: false, canCache: true, canRun: true }, cached: false }; });
    await H.boot(page);
    await expect(page.getByRole("checkbox").first()).toBeEnabled();
    await expect(page.getByText(/180MB/)).toBeVisible();
  });
});

test("the tokenizer regex repair holds in this browser", async ({ page }) => {
  await H.boot(page);
  // #dc-root mounts before the engine import resolves; the wrapper is
  // installed by that import, and marks itself on window.
  await page.waitForFunction(() => window.__nerRx === 1);
  const r = await page.evaluate(() => {
    const pat = String.raw`\w*[א-ת]\"[א-ת]\w*|\w+|\p{P}|[^\w\s]+`;
    let built = true; try { new RegExp(pat, "gu"); } catch (_) { built = false; }
    const split = built ? ('עו"ד רונית לוי'.match(new RegExp(pat, "gu")) || []).join("|") : "";
    const plain = new RegExp("\\d+", "g").test("42");
    let broken = false; try { new RegExp("(", "g"); } catch (_) { broken = true; }
    return { built, split, plain, broken };
  });
  expect(r.built).toBe(true);                    // DictaBERT's pattern builds
  expect(r.split).toBe('עו"ד|רונית|לוי');         // and tokenises Hebrew abbreviations
  expect(r.plain).toBe(true);                    // ordinary regexes are untouched
  expect(r.broken).toBe(true);                   // a genuinely broken one still throws
});
