/* The test and expect every browser check uses (docs/QUALITY-PLAN.md, layer 2).

   Each test runs as written, and then the app checks its own promises on the
   screen the test ended on: no card with punctuation at its edge and no two
   cards in the same letters, every listed value that appears in the document
   actually found, overlays sitting on what they point at, no horizontal
   overflow, no unresolved {{ }}, no page error and no runtime warning. So every
   test checks rules it was never written for.

   The checks live in the app (selfCheck in index.html), so the same code can
   later run inside real sessions. A test that deliberately leaves the page in a
   broken state opts out with test.info().annotations.push({ type: "no-self-check" }). */
const base = require("@playwright/test");

/* "Could not run" must never read as "found nothing" (outside review, H4). The check used
   to sit in a try with an empty catch and default to [] when the hook was missing, so a
   check that threw, or an engine that never finished loading, passed every spec. Only two
   things skip it now, and both are decided here rather than by an exception: the page is
   closed, or the page is not the app at all (null). Anything else comes back as a
   problem: a missing hook is "no-hook", a throwing check is "check-threw". */
async function selfCheckOf(page, hookTimeout = 10000) {
  if (page.isClosed()) return null;
  const isApp = await page.evaluate(() => !!document.querySelector("#dc-root")).catch(() => false);
  if (!isApp) return null;
  // measure the settled screen: running animations and transitions (a screen sliding in,
  // the spotlight moving between steps) finish first, up to 1.5 s, then two frames
  await page.evaluate(async () => {
    const t0 = Date.now();
    while (document.getAnimations().some((a) => a.playState === "running") && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  // the hook is installed once the engine module has loaded; give a slow load a moment
  const hooked = await page.waitForFunction(() => !!window.__pib, null, { timeout: hookTimeout }).then(() => true, () => false);
  if (!hooked) return [{ rule: "no-hook", detail: "window.__pib was never installed, so nothing was checked" }];
  return page.evaluate(() => {
    try { return window.__pib.check(true); } catch (e) { return [{ rule: "check-threw", detail: String((e && e.message) || e).slice(0, 160) }]; }
  });
}

const test = base.test.extend({
  selfCheck: [async ({ page }, use, info) => {
    await page.addInitScript(() => { window.__PIB_TEST = true; });
    const noise = [];
    page.on("console", (m) => { if (/never resolved/.test(m.text())) noise.push({ rule: "runtime-warning", detail: m.text().slice(0, 160) }); });
    page.on("pageerror", (e) => noise.push({ rule: "page-error", detail: String(e && e.message || e).slice(0, 160) }));
    await use();
    if (info.status !== info.expectedStatus) return;
    if (info.annotations.some((a) => a.type === "no-self-check")) return;
    const found = await selfCheckOf(page);
    if (found === null) return;
    base.expect([...found, ...noise], "self-check on the screen the test ended on").toEqual([]);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect, selfCheckOf };
