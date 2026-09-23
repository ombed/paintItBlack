const { test, expect } = require("./base");
const H = require("./helpers");

/* UX #2: the 185 MB model download started on "המשך" without a word, phones
   included. On a phone, or with data saver on, the tool now asks first, with
   two equal answers. On a computer nothing changed: the client works on a
   computer, her main complaint is names the tool missed, and the model is
   what finds them. */

const DOC = ["פרוטוקול", "דני כהן: שלום לכולם.", "רונית לוי: שלום.", "דני כהן: נתחיל."].join("\n");

async function open(page, { cached = false, names = [], saveData = false } = {}) {
  await page.addInitScript(({ cached, names, saveData }) => {
    window.__ner = { cached, names: () => names };
    if (saveData) Object.defineProperty(navigator, "connection", { get: () => ({ saveData: true }) });
  }, { cached, names, saveData });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await H.upload(page, "case.docx", DOC);
}
const ask = (page) => page.locator("[data-ner-ask]");
const calls = (page) => page.evaluate(() => window.__nerCalls || 0);

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

  test("the first scan asks before downloading, and nothing starts until answered", async ({ page }) => {
    await open(page);
    await H.startScan(page);
    await expect(ask(page)).toBeVisible();
    await expect(ask(page)).toContainText("185MB");
    expect(await calls(page)).toBe(0);
    await expect(page.getByRole("heading", { name: "מי מופיע בתיק" })).toHaveCount(0);
  });

  test("'בלי המודל' scans with the rules only", async ({ page }) => {
    await open(page, { names: ["דני כהן"] });
    await H.startScan(page);
    await ask(page).getByRole("button", { name: "בלי המודל" }).click();
    await expect(page.getByRole("heading", { name: "מי מופיע בתיק" })).toBeVisible({ timeout: 15000 });
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    expect(await calls(page)).toBe(0);
    // the rules still fill the list without the model
    expect((await H.listedNames(page)).length).toBeGreaterThan(0);
  });

  test("'להוריד את המודל' scans with it", async ({ page }) => {
    await open(page, { names: ["דני כהן"] });
    await H.startScan(page);
    await ask(page).getByRole("button", { name: "להוריד את המודל" }).click();
    await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
    expect(await calls(page)).toBeGreaterThan(0);
  });

  test("a model already on the phone is used without asking", async ({ page }) => {
    await open(page, { cached: true });
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
    await expect(ask(page)).toHaveCount(0);
    expect(await calls(page)).toBeGreaterThan(0);
  });
});

test("on a computer the model downloads as before, without a question", async ({ page }) => {
  await open(page);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
  await expect(ask(page)).toHaveCount(0);
  expect(await calls(page)).toBeGreaterThan(0);
});

test("with data saver on, a computer asks too", async ({ page }) => {
  await open(page, { saveData: true });
  await H.startScan(page);
  await expect(ask(page)).toBeVisible();
  expect(await calls(page)).toBe(0);
});
