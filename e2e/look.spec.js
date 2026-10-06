const { test, expect } = require("./base");
const H = require("./helpers");

/* The law report look (6.10), where it changes more than colour: the header carries the product's
   name, «אינקוגניטו», and on a phone it wraps so the name is never cut; the current step is said as well
   as shown; and nothing in the interface is set below the 11.5px floor, while growing the smallest text
   to that floor reflows no row (DESIGN.md, the Tool Floor Rule). */

// a merge suggestion on the people screen (שלוה / שלווה), and a name with a prefixed form on the
// work screen (לאבנר), so every small text the floor touched is on screen somewhere
const DOC = [
  "פרוטוקול דיון",
  "שלוה ליבוביץ: אני מבקשת לפתוח.",
  "אבנר שטרן: הגעתי מחיפה.",
  "שלוה ליבוביץ: שלחתי לאבנר שטרן את המסמך.",
  "אבנר שטרן: נכון.",
].join("\n");

const PHONE = { width: 390, height: 844 }, DESK = { width: 1440, height: 900 };

async function toEntry(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // on a phone the settings start closed
  if (!(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await page.locator("[data-settings-toggle]").click();
}
async function toPeople(page) {
  await toEntry(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("שלווה ליבוביץ");
  await input.press("Enter");
  await expect(page.locator("[data-merge-sug]").first()).toBeVisible();
}

// where the header's parts sit
const header = (page) => page.evaluate(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }; };
  const h = document.querySelector("header"), mark = h.querySelector("[data-wordmark]");
  return { header: box(h), mark: box(mark), block: box(mark && mark.parentElement), night: box(h.querySelector("[data-night]")),
    nav: box(h.querySelector("nav")), name: mark && mark.textContent, old: h.textContent.includes("השחרת מסמכים"), vw: innerWidth };
});

for (const vp of [DESK, PHONE]) {
  test(`the header carries «אינקוגניטו» in full, with the night switch beside it (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize(vp);
    await toPeople(page);
    const h = await header(page);
    expect(h.name).toBe("אינקוגניטו");
    expect(h.old, "the old name is gone from the header").toBe(false);
    // the name is never cut: it lies inside its block, which clips, and inside the screen
    expect(h.mark.l).toBeGreaterThanOrEqual(h.block.l - 0.5);
    expect(h.mark.r).toBeLessThanOrEqual(h.block.r + 0.5);
    expect(h.mark.l).toBeGreaterThanOrEqual(0);
    expect(h.mark.r).toBeLessThanOrEqual(h.vw);
    // the night switch sits on the name's row
    expect(Math.abs((h.night.t + h.night.b) / 2 - (h.mark.t + h.mark.b) / 2)).toBeLessThan(12);
    if (vp.width < 1120) {
      // on a phone the steps take a row of their own, under the name
      expect(h.nav.t).toBeGreaterThanOrEqual(h.night.b - 1);
      expect(h.nav.b).toBeLessThanOrEqual(h.header.b);
    } else {
      // on a computer it is still the one 56px bar
      expect(Math.round(h.header.h)).toBe(56);
      expect(Math.abs((h.nav.t + h.nav.b) / 2 - (h.mark.t + h.mark.b) / 2)).toBeLessThan(12);
    }
  });
}

/* On paper. The runtime prints backgrounds (print-color-adjust:exact), so the cloth header would print as a
   solid green block: printed, it is ink on the page, with a rule under it and the pen stroke in ink, and its
   frames too (the night switch's stayed gilt). At night the page itself prints dark, so there the header
   takes the night's ink: the day's ink on the night's page measured 1.03:1, a header no one could read. */
for (const dark of [false, true]) {
  test(`printed, the header is ink on the page and not a green block (${dark ? "night" : "day"})`, async ({ page }) => {
    if (dark) await page.emulateMedia({ colorScheme: "dark" });
    await toEntry(page);
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(dark);
    await page.emulateMedia({ media: "print" });
    const r = await page.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const alpha = (c) => (c.length > 3 ? c[3] : 1);
      const lum = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      // what prints behind an element: its backgrounds out to the first opaque one, each laid over the next
      const behind = (el) => {
        const layers = [];
        for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (alpha(c) > 0) { layers.push(c); if (alpha(c) >= 1) break; } }
        let b = [255, 255, 255];
        for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i], a = alpha(c); b = b.map((v, k) => a * c[k] + (1 - a) * v); }
        return b;
      };
      const ratio = (f, b) => { const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
      const h = document.querySelector("header"), mark = h.querySelector("[data-wordmark]");
      const texts = [...h.querySelectorAll("*")].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()));
      return {
        background: getComputedStyle(h).backgroundColor, count: texts.length,
        worst: Math.min(...texts.map((e) => ratio(rgb(getComputedStyle(e).color), behind(e)))),
        ink: getComputedStyle(mark).color, stroke: getComputedStyle(mark, "::after").backgroundColor,
        rule: getComputedStyle(h).borderBottomColor, frame: getComputedStyle(h.querySelector("[data-night]")).borderTopColor,
      };
    });
    await page.emulateMedia({ media: "screen" });
    expect(r.background, "no green block").toBe("rgba(0, 0, 0, 0)");
    expect(r.count).toBeGreaterThan(3);
    expect(r.worst, "the header's text against the page it prints on").toBeGreaterThanOrEqual(4.5);
    // one ink for the name, its pen stroke, the rule under the header and the night switch's frame
    expect(r.ink).toBe(dark ? "rgb(237, 230, 204)" : "rgb(21, 23, 27)");
    for (const [what, c] of [["the pen stroke", r.stroke], ["the rule", r.rule], ["the night switch's frame", r.frame]]) expect(c, what).toBe(r.ink);
  });
}

test("the current step is said, not only shown: aria-current, in the header's gilt", async ({ page }) => {
  await toEntry(page);
  const step = (name) => page.locator("header nav").getByRole("button", { name, exact: true });
  await expect(step("קובץ")).toHaveAttribute("aria-current", "step");
  await expect(step("קובץ")).toHaveCSS("color", "rgb(216, 182, 90)");
  await expect(step("מי בתיק")).not.toHaveAttribute("aria-current");
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(step("מי בתיק")).toHaveAttribute("aria-current", "step");
  await expect(step("מי בתיק")).toHaveCSS("color", "rgb(216, 182, 90)");
  await expect(step("קובץ")).not.toHaveAttribute("aria-current");
  await expect(page.locator('header [aria-current="step"]')).toHaveCount(1);
});

/* A step there is no way to yet («מי בתיק», «מקומות» before there is a document) took focus, and Enter did
   nothing (found live on v60). It is disabled now, so Tab passes it by and a screen reader says it is not
   available, and it keeps its look: the same pale ink, not the faded look of a disabled button */
test("a step there is no way to yet is disabled, Tab passes it by, and it looks as before", async ({ page }) => {
  await toEntry(page);
  const step = (name) => page.locator("header nav").getByRole("button", { name, exact: true });
  const pale = await page.locator("header nav span", { hasText: "בדיקה" }).evaluate((el) => getComputedStyle(el).color);
  for (const name of ["מי בתיק", "יישובים"]) {
    await expect(step(name)).toBeDisabled();
    await expect(step(name)).toHaveCSS("opacity", "1");
    await expect(step(name)).toHaveCSS("color", pale);
  }
  await step("קובץ").focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement.textContent.trim())).not.toMatch(/^(מי בתיק|מקומות)$/);
  // with a document they lead somewhere again
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  for (const name of ["מי בתיק", "יישובים"]) await expect(step(name)).toBeEnabled();
});

/* An empty box with dir="auto" has no letter to take its direction from, and the browser laid it out left to
   right: the paste box's Hebrew hint sat on the left with its «…» before it, and so did the restore box's
   (found live on v60). Empty, every such box is right to left; typed text still sets its own direction */
test("an empty text box shows its Hebrew hint right to left, and typed text keeps its own direction", async ({ page }) => {
  await toEntry(page);
  const empties = () => page.evaluate(() => [...document.querySelectorAll("textarea[dir=auto][placeholder], input[dir=auto][placeholder]")]
    .filter((el) => !el.value && el.getClientRects().length).map((el) => el.placeholder + ": " + getComputedStyle(el).direction));
  let found = await empties();
  expect(found.length).toBeGreaterThan(0);
  expect(found.filter((x) => !x.endsWith(": rtl"))).toEqual([]);
  const box = page.getByPlaceholder("הדבקת טקסט לבדיקה…");
  const dir = () => box.evaluate((el) => getComputedStyle(el).direction);
  await box.fill("Hello world");
  expect(await dir()).toBe("ltr");
  await box.fill("שלום עולם");
  expect(await dir()).toBe("rtl");
  await box.fill("");
  expect(await dir()).toBe("rtl");
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await expect(page.getByPlaceholder("הדבקת תשובת ה-AI…")).toBeVisible();
  found = await empties();
  expect(found.some((x) => x.startsWith("הדבקת תשובת ה-AI…"))).toBe(true);
  expect(found.filter((x) => !x.endsWith(": rtl"))).toEqual([]);
});

/* Everything the first screen needs waited for the engine (redact-engine.js, about 270KB): until it arrived a
   phone showed the computer's layout, the header's description line and the detection settings open, and a
   night page the day's moon, for up to two seconds on a slow line (found live on v60). The engine still
   loads first, but the page no longer waits for it to lay itself out */
test("on a phone the first screen is the phone's, by night the night's, while the engine is on its way", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ colorScheme: "dark" });
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route("**/redact-engine.js", async (route) => { await held; await route.continue(); });
  await page.addInitScript(() => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} });
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.locator("#boot")).toHaveCount(0);
  await expect(page.locator("[data-settings-toggle]")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("header").getByText("הכול רץ בדפדפן")).toHaveCount(0);
  await expect(page.locator("header [data-night] svg")).toHaveAttribute("data-icon", "sun");
  expect(await page.evaluate(() => !!window.__RE), "the engine is still held back").toBe(false);
  release();
  await expect.poll(() => page.evaluate(() => !!window.__RE), { timeout: 30000 }).toBe(true);
  await expect(page.locator("[data-settings-toggle]")).toHaveAttribute("aria-expanded", "false");
});

// every visible piece of text, and the "?" a waiting mark draws, under the 11.5px floor
const underFloor = (page) => page.evaluate(() => {
  const out = [];
  for (const el of [...document.querySelectorAll("#dc-root *"), document.getElementById("ver")]) {
    if (!el || !el.getClientRects().length) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    if (parseFloat(s.fontSize) < 11.5) out.push(`${el.tagName.toLowerCase()} ${s.fontSize} «${el.textContent.trim().slice(0, 24)}»`);
  }
  for (const m of document.querySelectorAll('[data-mark][data-badge="?"]')) {
    const px = getComputedStyle(m, "::after").fontSize;
    if (parseFloat(px) < 11.5) out.push("the ? on a waiting mark " + px);
  }
  return out;
});
/* The four <small> tags that had no size (the browser drew them at 10–10.8px) are at 11.5px now. Each one's
   row is measured as it is, then with the small set back to the browser's size: the floor must not have
   wrapped any row onto another line */
const SMALLS = [["[data-settings-toggle] small", "[data-settings-toggle]"], ["[data-merge-sug] small", "[data-merge-sug]"],
  ["[data-case-field] small", "[data-case-field]"], ["[data-form] small", "[data-forms]"]];
const rows = (page) => page.evaluate((items) => {
  const out = [];
  for (const [smallSel, rowSel] of items) for (const sm of document.querySelectorAll(smallSel)) {
    const row = sm.closest(rowSel); if (!row || !row.getClientRects().length) continue;
    const px = getComputedStyle(sm).fontSize, now = row.getBoundingClientRect().height;
    const keep = sm.style.fontSize; sm.style.fontSize = "smaller";
    const before = row.getBoundingClientRect().height;
    sm.style.fontSize = keep;
    out.push({ small: smallSel, px, now: Math.round(now * 2) / 2, before: Math.round(before * 2) / 2 });
  }
  return out;
}, SMALLS);

for (const vp of [PHONE, DESK]) {
  test(`nothing is under the 11.5px floor, and the floor wraps no row (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize(vp);
    await toEntry(page);
    expect(await underFloor(page), "entry").toEqual([]);
    const seen = [];
    const check = async (where) => {
      for (const r of await rows(page)) {
        expect(r.px, where + ": " + r.small).toBe("11.5px");
        // a wrapped row is a whole line taller (15px and more); half a pixel of a taller line box is not a wrap
        expect(r.now - r.before, where + ": the row of " + r.small + " gained no line").toBeLessThan(4);
        seen.push(r.small);
      }
    };
    await check("entry");
    await page.getByRole("checkbox").first().uncheck();
    await H.upload(page, "hearing.docx", DOC);
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    const input = page.getByPlaceholder(/שם מלא/);
    await input.fill("שלווה ליבוביץ");
    await input.press("Enter");
    await expect(page.locator("[data-merge-sug]").first()).toBeVisible();
    expect(await underFloor(page), "people").toEqual([]);
    await check("people");
    await H.goOn(page);
    const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
    await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
    if (await run.isVisible()) await run.click();
    await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
    // on a phone the findings are a tab of their own
    const tab = page.getByRole("button", { name: "ממצאים ובדיקה" });
    if (await tab.isVisible().catch(() => false)) await tab.click();
    await expect(page.locator("[data-forms]").first()).toBeVisible();
    expect(await underFloor(page), "work").toEqual([]);
    await check("work");
    // each of the four was on screen and measured
    for (const [sel] of SMALLS) expect(seen, "measured " + sel).toContain(sel);
  });
}
