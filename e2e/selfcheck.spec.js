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

/* Layer 5: the same check runs in a real session and writes what breaks to the
   session log, which travels in her test package. Rule, screen and count only. */
async function sessionLog(page) {
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  const btn = page.getByRole("button", { name: "העתקת יומן הסשן" });
  if (!(await btn.isVisible().catch(() => false))) await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await btn.click();
  return JSON.parse(await page.evaluate(() => window.__copied || "{}"));
}
const selfEvents = (log) => log.events.filter((e) => e.ev === "self-check");

test("in a session, a clean work screen writes no self-check event", async ({ page }) => {
  await toWork(page);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(2500);
  expect(selfEvents(await sessionLog(page))).toEqual([]);
});

test("in a session, a break is written to the log once, as a rule and a screen, with no text", async ({ page }) => {
  await toWork(page, `{ const d = Engine.prototype.detect; Engine.prototype.detect = function (t) { return d.call(this, t).filter((h) => h.base !== "אבנר שטרן"); }; }`);
  await expect.poll(async () => selfEvents(await sessionLog(page)).length, { timeout: 8000 }).toBeGreaterThan(0);
  // more triggers on the same screen: scrolling, a resize
  await page.mouse.wheel(0, 300);
  const vp = page.viewportSize();
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.waitForTimeout(300);
  await page.setViewportSize(vp);
  await page.waitForTimeout(2500);
  const log = await sessionLog(page);
  const ev = selfEvents(log);
  expect(ev.filter((e) => e.rule === "listed-not-handled")).toHaveLength(1);
  expect(ev[0]).toMatchObject({ rule: "listed-not-handled", screen: "work", n: 1 });
  expect(typeof ev[0].ms).toBe("number");
  expect(/[֐-׿]{3,}/.test(JSON.stringify(log))).toBe(false);
});

/* Review H4: the fixture turned "could not run" into "found nothing". A missing hook, or a
   check that throws, must come back as a problem and fail the test. */
test("a missing hook and a throwing check are reported, never read as clean", async ({ page }) => {
  const { selfCheckOf } = require("./base");
  await toWork(page);
  expect(await selfCheckOf(page)).toEqual([]);
  await page.evaluate(() => { window.__pib.check = () => { throw new Error("boom"); }; });
  expect((await selfCheckOf(page)).map((v) => v.rule)).toEqual(["check-threw"]);
  await page.evaluate(() => { delete window.__pib; });
  expect((await selfCheckOf(page, 500)).map((v) => v.rule)).toEqual(["no-hook"]);
  // a page that is not the app at all is skipped, and says so with null rather than []
  await page.goto("about:blank");
  expect(await selfCheckOf(page)).toBeNull();
});

// review L12: past forty kinds the log went silent, so a saturated session read as a clean one
test("a self-check log that is full says so once", async ({ page }) => {
  await toWork(page);
  await page.evaluate(() => { const s = window.__pib.seen(); for (let i = 0; i < 40; i++) s.add("filler-" + i + "|work"); });
  await page.evaluate(() => {
    const g = document.querySelector("[data-group]"), a = g.cloneNode(true);
    a.setAttribute("data-group", "a|אלונים\""); a.querySelector("span").textContent = "אלונים\"";
    g.parentNode.append(a);
  });
  await page.evaluate(() => { window.__pib.runCheck(); window.__pib.runCheck(); });
  const evs = await page.evaluate(() => window.__pib.log().events.map((e) => e.ev));
  expect(evs.filter((e) => e === "self-check-full")).toHaveLength(1);
  expect(evs).not.toContain("self-check");
});
