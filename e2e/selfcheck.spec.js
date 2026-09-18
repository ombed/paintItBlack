const { test, expect } = require("./base");
const H = require("./helpers");

/* The self-check must fire. A check that never reports anything looks exactly
   like a product with no bugs, so each rule is broken here on purpose and the
   report is expected to name it. These tests opt out of the automatic check,
   since they leave the page broken by design. */

// both speak twice, so both are on the list without the model
const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");
const check = (page) => page.evaluate(() => window.__pib.check(true));
const rules = async (page) => (await check(page)).map((v) => v.rule);

async function toWork(page, engineTail) {
  test.info().annotations.push({ type: "no-self-check" });
  await H.serveEngineWithStub(page);
  if (engineTail) {
    await page.route("**/redact-engine.js", async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) + "\n" + engineTail, headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" } });
    });
  }
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("a clean work screen passes", async ({ page }) => {
  await toWork(page);
  expect(await check(page)).toEqual([]);
});

test("a listed value that is in the document but never matched is reported", async ({ page }) => {
  // an engine whose word boundary is broken for one name, as it was for quoted names
  await toWork(page, `{ const d = Engine.prototype.detect; Engine.prototype.detect = function (t) { return d.call(this, t).filter((h) => h.base !== "אבנר שטרן"); }; }`);
  expect(await rules(page)).toContain("listed-not-handled");
  expect((await check(page)).find((v) => v.rule === "listed-not-handled").detail).toBe("אבנר שטרן");
});

test("a card whose title carries punctuation, and two cards in the same letters, are reported", async ({ page }) => {
  await toWork(page);
  await page.evaluate(() => {
    const g = document.querySelector("[data-group]"), a = g.cloneNode(true), b = g.cloneNode(true);
    a.setAttribute("data-group", "a|אלונים\""); a.querySelector("span").textContent = "אלונים\"";
    b.setAttribute("data-group", "a|אלונים"); b.querySelector("span").textContent = "אלונים";
    g.parentNode.append(a, b);
  });
  const r = await rules(page);
  expect(r).toContain("card-edge-punct");
  expect(r).toContain("card-duplicate");
});

test("an editor that no longer sits on its word is reported", async ({ page }) => {
  await toWork(page);
  await page.locator('[data-mark][data-val="רחל פרידמן"]').first().click();
  await expect(page.locator("[data-inline]")).toBeVisible();
  await page.evaluate(() => { document.querySelector("[data-inline]").style.top = "5px"; });
  expect(await rules(page)).toContain("inline-drift");
});

test("horizontal overflow and an unresolved placeholder are reported", async ({ page }) => {
  await toWork(page);
  await page.evaluate(() => {
    const w = document.createElement("div"); w.style.width = "3000px"; w.style.height = "1px"; document.querySelector("#dc-root").appendChild(w);
    const p = document.createElement("span"); p.textContent = "{{ g.ctx.pre }}"; document.querySelector("#dc-root").appendChild(p);
  });
  const r = await rules(page);
  expect(r).toContain("horizontal-overflow");
  expect(r).toContain("unresolved-placeholder");
});

test("a spotlight off its target is reported", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await page.waitForTimeout(500);
  expect(await rules(page)).not.toContain("spotlight-drift");
  await page.evaluate(() => { document.querySelector("[data-spot]").style.top = "40px"; });
  expect(await rules(page)).toContain("spotlight-drift");
});

test("without detail, the report carries rule names only — safe for a session log", async ({ page }) => {
  await toWork(page, `{ const d = Engine.prototype.detect; Engine.prototype.detect = function (t) { return d.call(this, t).filter((h) => h.base !== "אבנר שטרן"); }; }`);
  const bare = await page.evaluate(() => window.__pib.check(false));
  expect(bare.length).toBeGreaterThan(0);
  expect(JSON.stringify(bare)).not.toMatch(/[א-ת]/);
});
