/* A misbehaving user (docs/QUALITY-PLAN.md, layer 3).

   Tests walk the straight path: click, wait, click. A real person scrolls
   while reading, resizes the window, clicks on empty space to "close"
   something, tabs around, double-clicks a word, presses Escape and Back.
   The quoted-name leak and the drifting tour spotlight were both found that
   way, by the user, after three QA rounds had passed the straight path.

   disturb(page, label, opts) does all of that between two steps a journey
   expects, and after every single action it asks the app to check itself
   (selfCheck in index.html, the layer-2 rules). It also checks that the
   screen did not change under the user: nothing here is a request to move.

   The sequence is fixed, not random, so a failure reproduces from its label.

   opts:
     outside  click on empty space           (default true; false keeps an open editor)
     escape   Tab around, then Escape         (default true)
     back     browser Back, answered "stay"   (default true; the tour has no guard by design)
     dbl      double-click a word             (default true) */
const { expect } = require("@playwright/test");

const settle = (page) => page.evaluate(async () => {
  const t0 = Date.now();
  while (document.getAnimations().some((a) => a.playState === "running") && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});

async function checked(page, label, what) {
  await settle(page);
  const found = await page.evaluate(() => (window.__pib ? window.__pib.check(true) : [{ rule: "no-self-check-hook" }]));
  expect(found, `self-check after "${what}" (${label})`).toEqual([]);
}

const screenOf = (page) => page.evaluate(() => {
  const s = window.__pib.state();
  return { screen: s.screen, tour: s.tour ? s.tour.i : null };
});

// every element that scrolls on its own, plus the page
const scrollers = (page) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll("#dc-root *").forEach((el, i) => {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 40) {
      el.setAttribute("data-unruly-scroll", String(i)); out.push(String(i));
    }
  });
  return out;
});

// a point on the screen with nothing to press under it
const emptyPoint = (page) => page.evaluate(() => {
  const live = "button,a,input,textarea,select,label,summary,[role=button],[role=checkbox],[tabindex],[data-mark],[data-tour],[data-inline],[data-tip],[data-notice],[data-intro],[data-spot],[data-tour-block],[contenteditable]";
  const W = window.innerWidth, H = window.innerHeight;
  for (let y = H - 12; y > 40; y -= Math.max(20, Math.round(H / 24))) {
    for (let x = 8; x < W - 8; x += Math.max(20, Math.round(W / 16))) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest(live) && !el.closest("[data-work] section")) return { x, y };
    }
  }
  return null;
});

async function disturb(page, label, opts = {}) {
  const o = { outside: true, escape: true, back: true, dbl: true, ...opts };
  const before = await screenOf(page);
  const vp = page.viewportSize();

  // 1. scroll the page to the end and back to the middle
  await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await checked(page, label, "page scrolled to the end");
  await page.mouse.wheel(0, -Math.round(vp.height * 0.6));
  await checked(page, label, "wheel back up");

  // 2. every pane that scrolls on its own: to its end, then halfway
  for (const id of await scrollers(page)) {
    const pane = page.locator(`[data-unruly-scroll="${id}"]`);
    if (!(await pane.isVisible().catch(() => false))) continue;
    await pane.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await checked(page, label, `pane ${id} scrolled to its end`);
    await pane.evaluate((el) => { el.scrollTop = Math.round(el.scrollHeight / 2); });
    await checked(page, label, `pane ${id} scrolled halfway`);
  }

  // 3. the window narrows and comes back, the way a snapped window or a rotated phone does
  await page.setViewportSize({ width: Math.round(vp.width * 0.8), height: Math.round(vp.height * 0.85) });
  await checked(page, label, "window narrowed");
  await page.setViewportSize(vp);
  await checked(page, label, "window restored");

  // 4. a click on empty space
  if (o.outside) {
    const p = await emptyPoint(page);
    if (p) {
      await page.mouse.click(p.x, p.y);
      await checked(page, label, `click on empty space at ${p.x},${p.y}`);
    }
  }

  // 5. a double-click on a word of the text on screen, the way people select to copy
  if (o.dbl) {
    const word = page.locator("[data-work] section p, main p, main h1, main h2").filter({ hasText: /[א-ת]{3}/ }).first();
    if (await word.isVisible().catch(() => false)) {
      const box = await word.boundingBox();
      if (box && box.y > 0 && box.y < vp.height) {
        await page.mouse.dblclick(box.x + Math.min(20, box.width / 2), box.y + Math.min(8, box.height / 2));
        await checked(page, label, "double-click on a word");
      }
    }
  }

  // 6. Tab around, then Escape
  if (o.escape) {
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await checked(page, label, "Tab three times");
    await page.keyboard.press("Escape");
    await checked(page, label, "Escape");
  }

  // 7. Back, and "stay" when asked (Playwright dismisses a confirm by default). Only with a
  // document loaded: before that there is nothing to lose, and Back leaves the site as it should.
  if (o.back && (await page.evaluate(() => !!window.__pib.state().buf))) {
    const url = page.url();
    await page.goBack({ timeout: 3000 }).catch(() => {});
    expect(page.url(), `Back left the page (${label})`).toBe(url);
    await expect(page.locator("#dc-root")).toBeAttached();
    await checked(page, label, "Back, then stay");
  }

  // nothing above asked to move: the screen and the tour step are where they were
  expect(await screenOf(page), `the screen changed under the user (${label})`).toEqual(before);
  await page.evaluate(() => document.querySelectorAll("[data-unruly-scroll]").forEach((el) => el.removeAttribute("data-unruly-scroll")));
}

module.exports = { disturb, checked, settle };
