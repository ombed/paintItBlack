const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Stepping to a replacement with the arrows made it disappear.

   The arrows make the target the current replacement, which paints it with a
   solid accent background and text in the panel colour. Then the scroll
   handler started a flash animation that drove `background` alone. An animated
   property beats the element's own declaration, so for the whole 1.1 seconds
   the background was animated away to transparent while the text kept the
   panel colour: white on near-white paper in the light theme, dark on dark in
   the other. The word vanished, then popped back when the animation ended.

   The flash is now a ring, so it never touches the background or the text
   colour. This samples the real computed style while the animation runs. */

const DOC = [
  "פרוטוקול דיון",
  "רונית לוי: אני מבקשת לפתוח.",
  "רונית לוי: תודה רבה לכולם.",
  "דנה כהן: אני מסכימה עם רונית לוי.",
].join("\n");

const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);

test("stepping to a replacement never makes it invisible", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();

  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
  if (await run.isVisible().catch(() => false)) await run.click();

  const marks = page.locator("[data-mark]");
  await expect(marks.first()).toBeVisible({ timeout: 20000 });

  // step with the down arrow, then watch the target for the life of the flash
  await page.getByRole("button", { name: "החלפה הבאה" }).click();

  const worst = await page.evaluate(async () => {
    // the element the arrows jumped to is the one carrying the flash
    const el = document.querySelector('[data-mark][style*="flash"]');
    if (!el) return null;
    const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // whatever shows through when the mark paints no background of its own
    const behind = () => {
      let n = el.parentElement;
      while (n) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length < 4 || c[3] !== 0) return c;
        n = n.parentElement;
      }
      return [255, 255, 255];
    };
    let min = 255;
    const t0 = performance.now();
    while (performance.now() - t0 < 1400) {
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bgRaw = parse(cs.backgroundColor);
      const bg = bgRaw.length === 4 && bgRaw[3] === 0 ? behind() : bgRaw;
      min = Math.min(min, Math.abs(lum(fg) - lum(bg)));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return min;
  });

  expect(worst).not.toBeNull();
  // white on white is a difference of 0. Anything readable clears this easily.
  expect(worst).toBeGreaterThan(20);
});

test("the flash animation does not drive the background", async ({ page }) => {
  await H.boot(page);
  const drives = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules = [];
      try { rules = Array.from(sheet.cssRules || []); } catch (_) { continue; }
      for (const r of rules) {
        if (r.type === CSSRule.KEYFRAMES_RULE && r.name === "flash")
          return Array.from(r.cssRules).some((k) => /(^|[;{\s])background\s*:/.test(k.cssText));
      }
    }
    return null;
  });
  expect(drives).toBe(false);
});
