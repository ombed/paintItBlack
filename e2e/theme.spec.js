const { test, expect } = require("./base");
const H = require("./helpers");

/* Port of tests/theme_t.js. Same intent, against the rendered page rather
   than a static file: the visual language is the one that was designed, a
   dark token set exists and actually applies, the toggle flips and persists,
   and no token is used anywhere without a definition or a dark counterpart.
   Reading the live DOM makes the last two stronger than the original, which
   could only see the stylesheet: the redesign carries most of its styling
   inline, resolved from the template at runtime.

   The look is "the law report" (6.10): a bookcloth header with the product's name, a desk-grey page,
   bookcloth actions by day and gilt ones at night, and the tool's own fonts served by the site itself. */

const styleText = (page) =>
  page.evaluate(() => [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n"));
// the action colour the page really uses, wherever it was set
const accent = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toUpperCase());

test.beforeEach(async ({ page }) => { await H.boot(page); });

test("the visual language is the designed one", async ({ page }) => {
  const css = await styleText(page);
  expect(css).toMatch(/--bg:\s*#ECEDE7/);                   // the desk, not white
  expect(css).toMatch(/--accent:\s*#1D3A2E/);               // bookcloth green, not system blue
  expect(css).toMatch(/--doc-font:\s*'Noto Serif Hebrew'/); // serif for the document body
  expect(css).toMatch(/html\.dark\s*\{/);                   // a dark token block exists
  expect(css).toMatch(/--shadow:/);                         // cards get depth
  // nothing overrides the stylesheet's accent at run time: the canvas-only accent choice used to write
  // the old green inline on <html>, over both the day and the night palette
  expect(await accent(page)).toBe("#1D3A2E");
  // the header is bookcloth, and carries the product's name in Frank Ruhl Libre
  expect(await page.locator("header").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(29, 58, 46)");
  const mark = page.locator("header [data-wordmark]");
  await expect(mark).toHaveText("אינקוגניטו");
  expect(await mark.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Frank Ruhl Libre");
  await expect(page).toHaveTitle("אינקוגניטו");
});

test("the fonts are the site's own files, and all three families load from it", async ({ page }) => {
  // no Google Fonts left: no stylesheet or preconnect link, and the policy no longer names its hosts
  expect(await page.locator('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').count()).toBe(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  // every face the tool uses is declared
  const faces = await page.evaluate(() => [...document.fonts].map((f) => f.family.replace(/["']/g, "") + " " + f.weight));
  for (const f of ["Rubik 300", "Rubik 400", "Rubik 500", "Rubik 600", "Noto Serif Hebrew 400", "Noto Serif Hebrew 500", "Frank Ruhl Libre 900"])
    expect(faces).toContain(f);
  // each family really loads for Hebrew text: a font file that is missing fails silently, the browser
  // simply draws a fallback, so this is the only place a broken path would show
  const loaded = await page.evaluate(() => Promise.all(["400 15px Rubik", '400 16px "Noto Serif Hebrew"', '900 24px "Frank Ruhl Libre"']
    .map(async (f) => (await document.fonts.load(f, "א")).map((x) => x.status))));
  for (const l of loaded) {
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((s) => s === "loaded")).toBe(true);
  }
  // and the files came from this site's fonts/ folder, from nowhere else
  const files = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((e) => /\.woff2$/.test(new URL(e.name).pathname)).map((e) => e.name));
  for (const f of ["rubik-hebrew-400-normal.woff2", "noto-serif-hebrew-hebrew-400-normal.woff2", "FrankRuhlLibre-900-hebrew.woff2"])
    expect(files).toContain(new URL("fonts/" + f, page.url()).href);
  expect(files.filter((u) => new URL(u).origin !== new URL(page.url()).origin)).toEqual([]);
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
  // the switch shows what it switches to: the drawn moon by day, the drawn sun at night, one at a time
  await expect(btn.locator(`svg[data-icon="${before ? "moon" : "sun"}"]`)).toHaveCount(1);
  await expect(btn.locator(`svg[data-icon="${before ? "sun" : "moon"}"]`)).toHaveCount(0);
  // and the action colour follows the theme: bookcloth by day, gilt at night
  await expect.poll(() => accent(page)).toBe(before ? "#1D3A2E" : "#D8B65A");
  await btn.click();
  expect(await isDark()).toBe(before);
  expect(await bg()).toBe(bgBefore);
  await expect.poll(() => accent(page)).toBe(before ? "#D8B65A" : "#1D3A2E");

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
    // the header's cloth, its gilt and the highlighter are colours too, and so are the paper, the controls,
    // the placeholder text and the scrollbar thumb
    const colourish = [...root].filter((v) => /bg|panel|ink|line|accent|bad|warn|good|shadow|cloth|gilt|mark|paper|control|placeholder|scroll/.test(v));
    const noDark = colourish.filter((v) => !dark.has(v));
    return { used: used.size, missing, noDark };
  });
  console.log(`   tokens in use: ${r.used}`);
  expect(r.missing, "used without a definition").toEqual([]);
  expect(r.noDark, "colour token with no dark value").toEqual([]);
});
