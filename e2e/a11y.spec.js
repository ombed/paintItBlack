const { test, expect } = require("./base");
const H = require("./helpers");
const AxeBuilder = require("@axe-core/playwright").default;

/* Accessibility (outside review, batch D: M26–M32, L26–L30). Each finding has its own test, and
   axe (WCAG 2.1 A and AA) runs on every main screen and on the states the review found
   unnamed controls in. Screens are measured after their animations settle: a screen sliding
   in is half transparent, and its colours read as failing contrast. axe's own fetch of the
   page's stylesheets is turned off (preload): it was the Google Fonts sheet, which the page's policy
   rightly refused; the fonts come from the site itself since 6.10. */

const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי מחיפה.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");
// the axe run also needs a name with a prefix letter ("לאבנר"): its dimmed letter failed contrast
// on the live site, and no axe run had seen one (live smoke test of v54)
const DOC_PRE = [DOC, "רחל פרידמן: שלחתי לאבנר שטרן את המסמך."].join("\n");
const settle = (page) => page.evaluate(async () => {
  const t0 = Date.now();
  while (document.getAnimations().some((a) => a.playState === "running") && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
});
async function axe(page, where) {
  await settle(page);
  const r = await new AxeBuilder({ page }).options({ preload: false }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${where}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")})`)).toEqual([]);
}
/* axe leaves a one-letter text "incomplete" ("too short to determine if it is actual text"), so a
   prefix letter such as ל is never judged by it. This measures one element's contrast the way
   WCAG does: its colour, faded by its own and its ancestors' opacity, over the background behind
   it. That background is every background from the element out to the first opaque one, each
   translucent wash laid over what is under it: the night palette's gilt, warn and bad washes are
   translucent, and taking a wash for an opaque colour misjudged them. By day every background is
   opaque, and this is the same as taking the first one. */
async function contrastOf(locator) {
  return locator.evaluate((el) => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const alpha = (c) => (c.length > 3 ? c[3] : 1);
    const lum = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const layers = [];
    let bgEl = el;
    for (; bgEl; bgEl = bgEl.parentElement) {
      const c = rgb(getComputedStyle(bgEl).backgroundColor);
      if (alpha(c) > 0) { layers.push(c); if (alpha(c) >= 1) break; }
    }
    let b = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i], ca = alpha(c); b = b.map((v, k) => ca * c[k] + (1 - ca) * v); }
    let a = 1;
    for (let e = el; e && e !== bgEl; e = e.parentElement) a *= Number(getComputedStyle(e).opacity);
    const f = rgb(getComputedStyle(el).color);
    const fa = alpha(f) * a;
    const seen = f.slice(0, 3).map((v, i) => fa * v + (1 - fa) * b[i]);
    const [hi, lo] = [lum(seen), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  });
}
async function toPeople(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
async function toWork(page) {
  await toPeople(page);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("axe: entry, people, places and work screens, a selected card and the inline editor", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await axe(page, "entry");
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC_PRE);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await axe(page, "people");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) {
    await axe(page, "places");
    // a place left out was dimmed with opacity, under the contrast minimum
    const keep = page.locator("[data-extra-toggle] input").first();
    if (await keep.count()) { await keep.uncheck(); await axe(page, "places, a place left out"); await keep.check(); }
    await run.click();
  }
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await axe(page, "work");
  // a selected card shows "the same person as", which had no name (L27)
  await page.locator("[data-group]").first().click();
  await axe(page, "work, a card selected");
  await page.locator("[data-mark]").first().click();
  await expect(page.locator("[data-inline]")).toBeVisible();
  await axe(page, "work, the inline editor");
  // the prefix letter: on the mark, on the card's form buttons and in the inline editor
  await page.locator("[data-inline]").getByRole("button", { name: "סגירה" }).click();
  await expect(page.locator("[data-inline]")).toHaveCount(0);
  const pre = page.locator('[data-mark][data-val="לאבנר שטרן"]').first();
  await expect(pre.locator("[data-pre]")).toHaveText("ל");
  expect(await contrastOf(pre.locator("[data-pre]"))).toBeGreaterThanOrEqual(4.5);
  await page.locator("[data-group]", { hasText: "אבנר" }).first().click();
  const form = page.locator("[data-form]", { hasText: "לאבנר" }).first();
  await expect(form.locator("span").first()).toHaveText("ל");
  expect(await contrastOf(form.locator("span").first())).toBeGreaterThanOrEqual(4.5);
  await axe(page, "work, a card with a prefixed form");
  await pre.click();
  const inlinePre = page.locator("[data-inline] [data-inline-pre]").first();
  await expect(inlinePre).toHaveText("ל");
  expect(await contrastOf(inlinePre)).toBeGreaterThanOrEqual(4.5);
  await axe(page, "work, the inline editor on a prefixed name");
});

/* The night palette (6.10) is a palette of its own, cream ink on cloth-black with gilt actions, so it gets
   its own axe run: until then no contrast check ever ran at night. axe blends the translucent washes
   (the gilt wash, the warn and bad washes) over what is behind them. */
test("axe at night: entry and work screens, a selected card and the inline editor", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  await axe(page, "entry, night");
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC_PRE);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await axe(page, "work, night");
  // a selected card marks its name in the document with the highlighter, in dark ink at night too
  await page.locator("[data-group]").first().click();
  await axe(page, "work, a card selected, night");
  await page.locator("[data-mark]").first().click();
  await expect(page.locator("[data-inline]")).toBeVisible();
  await axe(page, "work, the inline editor, night");
  // the prefix letter at night, as by day: axe leaves a one-letter text undecided, so it is measured here,
  // on the mark, on the card's form button (over the night's translucent gilt wash) and in the inline editor
  await page.locator("[data-inline]").getByRole("button", { name: "סגירה" }).click();
  await expect(page.locator("[data-inline]")).toHaveCount(0);
  const pre = page.locator('[data-mark][data-val="לאבנר שטרן"]').first();
  await expect(pre.locator("[data-pre]")).toHaveText("ל");
  expect(await contrastOf(pre.locator("[data-pre]")), "the prefix letter on the mark, night").toBeGreaterThanOrEqual(4.5);
  await page.locator("[data-group]", { hasText: "אבנר" }).first().click();
  const form = page.locator("[data-form]", { hasText: "לאבנר" }).first();
  await expect(form.locator("span").first()).toHaveText("ל");
  expect(await contrastOf(form.locator("span").first()), "the prefix letter on the form button, night").toBeGreaterThanOrEqual(4.5);
  await axe(page, "work, a card with a prefixed form, night");
  await pre.click();
  const inlinePre = page.locator("[data-inline] [data-inline-pre]").first();
  await expect(inlinePre).toHaveText("ל");
  expect(await contrastOf(inlinePre), "the prefix letter in the inline editor, night").toBeGreaterThanOrEqual(4.5);
  await axe(page, "work, the inline editor on a prefixed name, night");
});

test("M28: what changes while she works is announced", async ({ page }) => {
  await toWork(page);
  await expect(page.locator('[data-bar-text][role="status"]')).toHaveCount(1);
  const counter = page.locator('span[aria-live="polite"][aria-atomic="true"]');
  await expect(counter).toHaveCount(1);
  // a download says where the file went, in the notice; the notice's status region is there before it
  // (a region that appears together with its text is often not announced: the independent review of 6.10)
  await page.evaluate(() => document.querySelectorAll('[role="status"]').forEach((el) => { el.__before = true; }));
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת Word" }).click();
  const anyway = page.getByRole("button", { name: "להוריד בכל זאת" });
  if (await anyway.isVisible()) await anyway.click();
  await dl;
  await expect(page.locator('[role="status"] > [data-notice]')).toBeVisible();
  expect(await page.locator("[data-notice]").evaluate((el) => !!el.parentElement.__before), "the notice's status region was there before the notice").toBe(true);
});

test("M29, M30: where a name appears, and choosing a card, work from the keyboard", async ({ page }) => {
  await toPeople(page);
  const tip = page.locator('[data-tip="1"]').first();
  await tip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-tip="panel"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const name = page.locator("[data-group] [data-kbd]").first();
  await name.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => !!window.__pib.state().sel)).toBe(true);
});

test("M31: an English answer runs left to right on the restore screen", async ({ page }) => {
  // the round trip as e2e/steps.spec.js drives it, on a document with nothing left pending
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", ["פרוטוקול דיון — התובעת: רונית לוי", "רונית לוי הגישה בקשה לצו הגנה.", "הדיון התקיים ביום שלישי."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
  const bar = page.locator("[data-bar]");
  await bar.getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  const box = page.locator("textarea[aria-label='תשובת ה-AI']");
  await expect(box).toBeVisible();
  await box.fill("Based on the document, the plaintiff spoke first.");
  expect(await box.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
});

test("M32: the tour is a dialog left by keyboard, and a key press outside the lit area is stopped like a click", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" }); // the tour's sample document is not hers
  // a first visit, the way e2e/tour.spec.js starts it: the intro offers the tour
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const card = page.locator('[data-tour][role="dialog"]');
  await expect(card).toBeVisible({ timeout: 15000 });
  const toggle = page.getByRole("button", { name: "מצב יום או לילה" });
  const dark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const before = await dark();
  await toggle.focus();
  await page.keyboard.press("Enter");
  expect(await dark()).toBe(before);
  await expect(page.locator("[data-tour-nudge]")).toBeVisible();
  // the way out by keyboard is the card's close button; a stray Escape does not end the tour
  // (e2e/unruly.spec.js pins that a stray key never changes her screen)
  await page.keyboard.press("Escape");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "סגירת הסיור" }).focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveCount(0);
});

test("L26: with reduced motion asked for, nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const d = await page.evaluate(() => getComputedStyle(document.body).animationDuration + " " + getComputedStyle(document.body).transitionDuration);
  expect(d.split(" ").every((x) => parseFloat(x) <= 0.001)).toBe(true);
});

test("L28, L30: pressed and expanded states are exposed, and the file error is tied to its control", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles("e2e/fixtures/case-empty.docx");
  await expect(page.locator("[data-file-err]#file-err")).toBeVisible();
  expect(await page.locator('[data-tour-target="upload"]').getAttribute("aria-describedby")).toBe("file-err");
  const settings = page.locator("[data-settings-toggle]");
  if ((await settings.getAttribute("aria-expanded")) !== "true") await settings.click();
  const pressed = await page.getByRole("button", { name: "שם בדוי" }).getAttribute("aria-pressed");
  expect(["true", "false"]).toContain(pressed);
  await toWorkFrom(page);
  const sections = page.locator("[data-section]");
  expect(await sections.count()).toBeGreaterThan(0);
  for (const v of await sections.evaluateAll((els) => els.map((e) => e.getAttribute("aria-expanded")))) expect(["true", "false"]).toContain(v);
});
async function toWorkFrom(page) {
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

/* WCAG 4.1.2: a set of buttons where one is chosen says which one, as «שם בדוי» always did. The document's
   view («מושחר» / «מקור»), the findings filters, the manual add's kinds and the phone's two panes showed
   the choice only in colour (already in v59); each is aria-pressed now, and the choice moves with a click. */
test("the chosen view, filter, kind and pane are said, not only shown", async ({ page }) => {
  await toWork(page);
  const pair = async (on, off) => {
    await expect(on).toHaveAttribute("aria-pressed", "true");
    await expect(off).toHaveAttribute("aria-pressed", "false");
  };
  const red = page.getByRole("button", { name: "אחרי ההחלפה", exact: true }), orig = page.getByRole("button", { name: "מקור", exact: true });
  await pair(red, orig);
  await orig.click();
  await pair(orig, red);
  await red.click();
  await pair(red, orig);
  const all = page.getByRole("button", { name: /^הכל \d+$/ }), rep = page.getByRole("button", { name: /^הוחלף \d+$/ });
  await pair(all, rep);
  await rep.click();
  await pair(rep, all);
  const person = page.getByRole("button", { name: "אדם", exact: true }), place = page.getByRole("button", { name: "מקום", exact: true });
  await pair(person, place);
  await place.click();
  await pair(place, person);
  // every chip in those rows says it, chosen or not: none is left without a state
  const states = await page.locator("[data-work] button[aria-pressed]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-pressed")));
  expect(states.length).toBeGreaterThanOrEqual(8);
  expect(states.every((s) => s === "true" || s === "false")).toBe(true);
  // on a phone, the findings and the document are two panes, one shown at a time
  await page.setViewportSize({ width: 390, height: 844 });
  const find = page.getByRole("button", { name: "ממצאים ובדיקה", exact: true }), doc = page.getByRole("button", { name: "המסמך", exact: true });
  await expect(find).toBeVisible();
  if ((await find.getAttribute("aria-pressed")) === "true") { await doc.click(); await pair(doc, find); await find.click(); await pair(find, doc); }
  else { await pair(doc, find); await find.click(); await pair(find, doc); await doc.click(); await pair(doc, find); }
});

/* The replacement arrow between a name and the name that takes its place is drawn now, and a drawn icon is
   silent. The ← it replaced was read aloud ("left arrow"), and it was the only word saying "replaced by":
   without it a screen reader read «נועה שרעבי אירינה אשכנזי», two names side by side. A hidden ← stays beside
   the drawn arrow, as the hidden ✓ stays beside the step bar's drawn check. */
test("a screen reader still hears the arrow between a name and its replacement", async ({ page }) => {
  await toWork(page);
  const card = page.locator("[data-group]").filter({ has: page.locator('svg[data-icon="arrow-left"]') }).first();
  await expect(card.locator('svg[data-icon="arrow-left"]')).toBeVisible();
  // the accessibility tree, not the DOM's text: what a screen reader is given
  expect(await card.ariaSnapshot()).toMatch(/←\s*[֐-׿]/);
  // and the inline editor's «X ← Y» line, on a replaced name (not a deleted or a waiting one)
  await page.locator('[data-mark][data-kind=""]').first().click();
  const inline = page.locator("[data-inline]");
  await expect(inline.locator('svg[data-icon="arrow-left"]')).toBeVisible();
  expect(await inline.ariaSnapshot()).toMatch(/←\s*[֐-׿]/);
});

/* WCAG 2.4.11: a control that takes the keyboard's focus is not hidden by what sits over the page. The bottom
   bar is fixed and the header sticky, and the browser scrolled a focused control into the window without
   knowing that either covers part of it: Tab left the first card's buttons and the document's marks under the
   bar, and Shift+Tab left them under the header, ring and all (already in v59). The page now keeps its scroll
   clear of both, and the two scrolling areas (the document, the findings list) keep the whole ring inside. */
const LONG = [
  "פרוטוקול פגישה בעניין הקטינה נועה שרעבי, בת 9.",
  "מיכל שרעבי: אני האם. אנחנו גרים בחולון, ברחוב הזית 12.",
  "אורן שרעבי: אני האב. אני גר ברמת גן, והילדה אצלי בסופי שבוע.",
  "לודמילה כץ: אני המורה של הילדה. יש שיפור בלימודים.",
  "נועה שרעבי: אני אוהבת את בית הספר.",
  "מיכל שרעבי: מספר הזהות שלי 314277062, והטלפון 052-6613874.",
  "אורן שרעבי: הדיון הקודם התקיים ב-11.2.2026 בבית המשפט לענייני משפחה.",
  "לודמילה כץ: אשמח לעדכן שוב בחודש הבא.",
  "נועה שרעבי: ואת המורה.",
].join("\n");
const FOCUS_SEEN = () => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  if (!el.__stop) el.__stop = (window.__stops = (window.__stops || 0) + 1);
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const ext = Math.max(0, (cs.outlineStyle === "none" ? 0 : parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0));
  const ring = { top: r.top - ext, bottom: r.bottom + ext };
  const bad = [];
  const bar = document.querySelector("[data-bar]"), head = document.querySelector("header");
  if (bar && !bar.contains(el) && ring.bottom > bar.getBoundingClientRect().top + 0.5) bad.push("under the bar by " + (ring.bottom - bar.getBoundingClientRect().top).toFixed(1) + "px");
  if (head && !head.contains(el) && ring.top < head.getBoundingClientRect().bottom - 0.5) bad.push("under the header by " + (head.getBoundingClientRect().bottom - ring.top).toFixed(1) + "px");
  if (ring.top < -0.5 || ring.bottom > window.innerHeight + 0.5) bad.push("off the window");
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (s.overflowY !== "auto" && s.overflowY !== "scroll") continue;
    const b = a.getBoundingClientRect();
    if (ring.top < b.top - 0.5 || ring.bottom > b.bottom + 0.5) bad.push("its ring cut by the scrolling area's edge");
    break;
  }
  const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 30);
  return { stop: el.__stop, name, bad };
};
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`a focused control is never hidden under the header or the bottom bar (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize(vp);
    await H.serveEngineWithStub(page);
    await H.boot(page);
    if (!(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await page.locator("[data-settings-toggle]").click();
    await page.getByRole("checkbox").first().uncheck();
    await H.upload(page, "case.docx", LONG);
    await H.startScan(page);
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    await H.goOn(page);
    const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
    await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
    if (await run.isVisible()) await run.click();
    await expect(page.locator("[data-mark]").first()).toBeAttached({ timeout: 20000 });
    const walk = async (key) => {
      const found = [];
      let first = null, stops = 0;
      for (let i = 0; i < 400; i++) {
        await page.keyboard.press(key);
        const s = await page.evaluate(FOCUS_SEEN);
        if (!s) continue;
        if (first === null) first = s.stop; else if (s.stop === first) break; // once round the page
        stops++;
        if (s.bad.length) found.push(`${key} #${stops} «${s.name}»: ${s.bad.join(", ")}`);
      }
      // a walk that met only a handful of stops proves nothing
      expect(stops, key + ": stops met").toBeGreaterThan(20);
      return found;
    };
    // forwards from the top of the page, and backwards from its foot (the bar)
    const both = async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator("[data-wordmark]").click();
      const fwd = await walk("Tab");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.locator("[data-bar]").click({ position: { x: 3, y: 3 } });
      return [...fwd, ...(await walk("Shift+Tab"))];
    };
    const found = await both();
    // on a phone the findings and the document are two panes, one at a time: the other one is walked too
    const findTab = page.getByRole("button", { name: "ממצאים ובדיקה", exact: true });
    if (await findTab.isVisible().catch(() => false)) {
      const other = (await findTab.getAttribute("aria-pressed")) === "true" ? page.getByRole("button", { name: "המסמך", exact: true }) : findTab;
      await other.click();
      found.push(...(await both()));
    }
    expect(found).toEqual([]);
  });
}

/* WCAG 1.4.10: at 320px (a 1280px screen at 400% zoom) nothing runs off the side of the screen. The bottom
   bar's step row grew with its drawn chevrons, wider than the › they replaced, and pushed «3 החזרת שמות» 12px
   past the screen's edge; it wraps now when it has no room, and stays one line when it does. */
test("at 320px, the bottom bar's steps stay on the screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator("[data-settings-toggle]").click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-steps]")).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-step="3"]')).toContainText("3 החזרת שמות");
  const off = await page.evaluate(() => [...document.querySelectorAll("[data-bar] *")]
    .filter((e) => !e.closest("svg, .vh") && e.getClientRects().length)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.left < -0.5 || r.right > innerWidth + 0.5)
    .map(({ e, r }) => `${(e.textContent || e.tagName).trim().slice(0, 24)} ${r.left.toFixed(1)}..${r.right.toFixed(1)}`));
  expect(off, "in the bottom bar, off the side of a 320px screen").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("M26: at 200% zoom the document is still on the screen", async ({ page }) => {
  await toWork(page);
  // 200% zoom of a 1280×720 screen, set once the work screen is up
  await page.setViewportSize({ width: 640, height: 360 });
  await settle(page);
  const h = await page.evaluate(() => { let el = document.querySelector("[data-mark]"); while (el && getComputedStyle(el).overflowY !== "auto") el = el.parentElement; return el ? el.getBoundingClientRect().height : 0; });
  expect(h).toBeGreaterThanOrEqual(250);
});

test("M27: an input's border is at least 3:1 against its background", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector("textarea") || document.querySelector("input:not([type=checkbox]):not([type=file])");
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const L = ([r, g, b]) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    let bgEl = el, bg = "rgba(0, 0, 0, 0)";
    while (bgEl && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bgEl = bgEl.parentElement; bg = bgEl ? getComputedStyle(bgEl).backgroundColor : "rgb(255,255,255)"; }
    const a = L(rgb(getComputedStyle(el).borderTopColor)), b = L(rgb(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(r).toBeGreaterThanOrEqual(3);
});

test("L29: a selection made with the keyboard opens the same popup as one made with the mouse", async ({ page }) => {
  await toWork(page);
  // a word of plain text in the document, selected, and the selection extended with Shift+arrow
  const ok = await page.evaluate(() => {
    const sheet = [...document.querySelectorAll("p[dir='auto']")].find((p) => /הגעתי/.test(p.textContent));
    if (!sheet) return false;
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode()) && !/הגעתי/.test(n.data));
    if (!n) return false;
    const i = n.data.indexOf("הגעתי"), r = document.createRange();
    r.setStart(n, i); r.setEnd(n, i + 5);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    return true;
  });
  expect(ok).toBe(true);
  await page.keyboard.press("Shift+ArrowLeft");
  await expect.poll(() => page.evaluate(() => !!window.__pib.state().popup)).toBe(true);
});
