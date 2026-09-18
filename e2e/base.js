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

const test = base.test.extend({
  selfCheck: [async ({ page }, use, info) => {
    await page.addInitScript(() => { window.__PIB_TEST = true; });
    const noise = [];
    page.on("console", (m) => { if (/never resolved/.test(m.text())) noise.push({ rule: "runtime-warning", detail: m.text().slice(0, 160) }); });
    page.on("pageerror", (e) => noise.push({ rule: "page-error", detail: String(e && e.message || e).slice(0, 160) }));
    await use();
    if (info.status !== info.expectedStatus) return;
    if (info.annotations.some((a) => a.type === "no-self-check")) return;
    let found = [];
    try {
      // measure the settled screen: running animations and transitions (a screen sliding in,
      // the spotlight moving between steps) finish first, up to 1.5 s, then two frames
      await page.evaluate(async () => {
        const t0 = Date.now();
        while (document.getAnimations().some((a) => a.playState === "running") && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 50));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      found = await page.evaluate(() => (window.__pib ? window.__pib.check(true) : []));
    } catch (e) {
      // the page is closed, or on another origin (the live-site smoke)
    }
    base.expect([...found, ...noise], "self-check on the screen the test ended on").toEqual([]);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect };
