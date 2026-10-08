const { test, expect } = require("./base");
const H = require("./helpers");

/* The owner, 8.10: Chrome's Back arrow sometimes did nothing, or was grey. Chrome's Back button skips a history
   entry that a page left by history.pushState without a click or a key just before. The document's entry was
   pushed when the file finished loading, after the file dialog. Now no entry is pushed without that gesture
   (canPush); the document's waits for the next click or key. Playwright cannot press Chrome's own Back button,
   so these check the rule itself: what is pushed, and when. */

const DOC = "פרוטוקול. נועה שרעבי הגיעה לדיון. נועה שרעבי טענה כי הבקשה מוצדקת.";
const pushes = (page) => page.evaluate(() => window.__pushes);
async function watch(page) {
  // every pushState, and whether the page had a gesture at that moment
  await page.addInitScript(() => {
    window.__pushes = [];
    const push = window.history.pushState.bind(window.history);
    window.history.pushState = (s, t, u) => { window.__pushes.push({ state: s && s.pib, active: window.navigator.userActivation.isActive }); return push(s, t, u); };
  });
}

test("a document that loads with no gesture pushes its history entry at the next click, never before", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  await watch(page);
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  // a file dropped by the page's own timer, six seconds on, carries no gesture: like a file that finishes loading
  // long after the click that opened the dialog. (Playwright's own file setting, and every evaluate, count as a
  // gesture, so the drop is scheduled once and nothing of the test's touches the page until it has happened.)
  await page.evaluate(async (t) => {
    const mod = await import("./text-to-docx.js");
    const bytes = await mod.textToDocx(t);
    setTimeout(() => {
      window.__dropActive = window.navigator.userActivation.isActive;
      const file = new window.File([bytes], "case.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const dt = new window.DataTransfer(); dt.items.add(file);
      document.querySelector("[data-tour-target=upload]").dispatchEvent(new window.DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, 6000);
  }, DOC);
  await page.waitForTimeout(6500);
  await expect(page.getByText("case.docx")).toBeVisible();
  expect(await page.evaluate(() => window.__dropActive), "the drop had no gesture").toBe(false);
  expect((await pushes(page)).filter((p) => p.state === 1)).toEqual([]);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect.poll(() => pushes(page)).toContainEqual({ state: 1, active: true });
  expect((await pushes(page)).every((p) => p.active), "every entry was pushed with a gesture").toBe(true);
});

test("the demo's tour, started on its own, pushes no history entry", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  await watch(page);
  await page.addInitScript(() => { window.__inkDemo = { signup: "login.html?mode=signup" }; });
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("[data-tour]")).toContainText("קובץ או טקסט", { timeout: 60000 });
  expect((await pushes(page)).every((p) => p.active), "no entry without a gesture").toBe(true);
});
