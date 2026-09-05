const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Port of tests/theme_t.js. Same intent, against the rendered page rather
   than a static file: the visual language is the one that was designed, a
   dark token set exists and actually applies, the toggle flips and persists,
   and no token is used anywhere without a definition or a dark counterpart.
   Reading the live DOM makes the last two stronger than the original, which
   could only see the stylesheet: the redesign carries most of its styling
   inline, resolved from the template at runtime. */

const styleText = (page) =>
  page.evaluate(() => [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n"));

test.beforeEach(async ({ page }) => { await H.boot(page); });

test("the visual language is the designed one", async ({ page }) => {
  const css = await styleText(page);
  expect(css).toMatch(/--bg:\s*#F4F2ED/);                   // warm paper, not white
  expect(css).toMatch(/--accent:\s*#1F5B44/);               // ink green, not system blue
  expect(css).toMatch(/--doc-font:\s*'Noto Serif Hebrew'/); // serif for the document body
  expect(css).toMatch(/html\.dark\s*\{/);                   // a dark token block exists
  expect(css).toMatch(/--shadow:/);                         // cards get depth
  // Two font links exist, one in the head and one from the template; either may carry the families.
  const fonts = (await page.locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute("href")))).join(" ");
  expect(fonts).toContain("Noto+Serif+Hebrew");
  expect(fonts).toContain("Rubik");
});

test("the toggle flips dark mode, applies it, and remembers it", async ({ page }) => {
  const btn = page.getByRole("button", { name: "מצב יום או לילה" });
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  const stored = () => page.evaluate(() => localStorage.getItem("redact-theme"));

  const before = await isDark(), bgBefore = await bg();
  await btn.click();
  expect(await isDark()).toBe(!before);
  expect(await stored()).toBe(before ? "light" : "dark");
  expect(await bg()).not.toBe(bgBefore);                  // the dark block actually applies
  await expect(btn).toHaveText(before ? "☾" : "☀");
  await btn.click();
  expect(await isDark()).toBe(before);
  expect(await bg()).toBe(bgBefore);

  // Persisted across a reload.
  await btn.click();
  await page.reload();
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  expect(await isDark()).toBe(!before);
});

test("every token used anywhere is defined, and every colour has a dark value", async ({ page }) => {
  const r = await page.evaluate(() => {
    const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const inline = [...document.querySelectorAll("[style]")].map((e) => e.getAttribute("style")).join("\n");
    const names = (s) => new Set([...s.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]));
    const used = new Set([...names(css), ...names(inline)]);
    const block = (sel) => {
      const i = css.indexOf(sel); if (i < 0) return "";
      return css.slice(i, css.indexOf("}", i));
    };
    const defs = (s) => new Set([...s.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const root = defs(block(":root{")), dark = defs(block("html.dark{"));
    // applyProps sets a few on the element at runtime; count those as defined.
    for (const n of ["accent", "accent-ink", "accent-soft", "doc-font", "rail-w"])
      if (document.documentElement.style.getPropertyValue("--" + n)) root.add(n);
    const missing = [...used].filter((v) => !root.has(v));
    const colourish = [...root].filter((v) => /bg|panel|ink|line|accent|bad|warn|good|shadow/.test(v));
    const noDark = colourish.filter((v) => !dark.has(v));
    return { used: used.size, missing, noDark };
  });
  console.log(`   tokens in use: ${r.used}`);
  expect(r.missing, "used without a definition").toEqual([]);
  expect(r.noDark, "colour token with no dark value").toEqual([]);
});
