const { test, expect } = require("./base");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("fs");
const path = require("path");

/* The home page (site/index.html), in the law-report design (6.10), and the site's other pages,
   which share its frame. What it pins:
   - the spine stays still while the page scrolls; on a phone it is a green bar whose menu opens a
     sheet of links, and a link or Escape closes it;
   - the passage you can point at: a name, by mouse or by Tab, lights every place that person
     appears (the original, what the AI gets, the answer) and dims the rest;
   - the tally: one mark per identifying detail in the test set, as many hollow as the figure says
     were missed;
   - nothing is cut or scrolls sideways down to 320 px; reduced motion turns the motion off;
   - WCAG 2.1 AA by axe, at desktop and phone width;
   - the other pages (legal, sign-in, 404): the same spine and phone menu, nothing cut, axe; the
     sign-in page is marked as current, and reads an emailed link itself, even at its short address.
   The base fixture also fails a test on anything the page's Content-Security-Policy refuses. */
const HOME = "/site/index.html";
const SITE = path.join(__dirname, "..", "site");
const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";

async function axe(page, where) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${where}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")})`)).toEqual([]);
}
// the pages hide sideways overflow, so measure the boxes: none may reach past either edge
const cutOff = (page) => page.evaluate(() => [...document.querySelectorAll("body *")]
  .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1); })
  .map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "")).slice(0, 6));
// the 404 names its files from the root, since it is served at any depth: serve the site there too
// (on whatever port the test server listens)
async function siteAtRoot(page) {
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/(?!site\/)[^?#]+/, (route) => {
    const f = path.join(SITE, new URL(route.request().url()).pathname);
    return fs.existsSync(f) && fs.statSync(f).isFile() ? route.fulfill({ path: f }) : route.continue();
  });
}

test("the passage: a name lights every place that person appears, by mouse and by keyboard", async ({ page }) => {
  await page.goto(HOME);
  const demo = page.locator("#demo");
  await demo.locator('.nm[data-p="b"]').first().hover();
  await expect(demo).toHaveClass(/\bfocus\b/);
  // the same person: twice in the original, twice in the AI's copy (as Adler), once in the answer
  await expect(demo.locator(".on")).toHaveCount(5);
  await expect(demo.locator('.on:not([data-p="b"])')).toHaveCount(0);
  await page.mouse.move(1, 1);
  await expect(demo).not.toHaveClass(/\bfocus\b/);
  await expect(demo.locator(".on")).toHaveCount(0);

  // Tab goes from the hero's last link to the names, in reading order, each with a focus ring
  await page.getByRole("link", { name: "לראות איך זה עובד" }).focus();
  await page.keyboard.press("Tab");
  const first = demo.locator(".nm").first();
  await expect(first).toBeFocused();
  await expect(first).toHaveText("עו״ד נעמה ברק");
  expect(await first.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await expect(demo.locator('.on[data-p="a"]')).toHaveCount(2);
  await page.keyboard.press("Tab");
  await expect(demo.locator(".nm").nth(1)).toBeFocused();
  await expect(demo.locator('.on[data-p="b"]')).toHaveCount(5);
  await expect(demo.locator('.on[data-p="a"]')).toHaveCount(0);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect(demo.locator(".on")).toHaveCount(0);
  await expect(demo).not.toHaveClass(/\bfocus\b/);
});

test("the tally: one mark per identifying detail, as many hollow as the figure says were missed", async ({ page }) => {
  await page.goto(HOME);
  const [found, total] = (await page.locator(".tally .n").innerText()).match(/\d+/g).map(Number);
  await expect(page.locator(".dots i")).toHaveCount(total);
  await expect(page.locator(".dots i.miss")).toHaveCount(total - found);
  // the marks are a picture of the figure, which says it in words
  await expect(page.locator(".dots")).toHaveAttribute("aria-hidden", "true");
});

test("on a desktop the spine holds the index and stays still while the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(HOME);
  await expect(page.getByRole("navigation", { name: "ראשי" })).toBeVisible();
  await expect(page.getByRole("button", { name: "תפריט" })).toBeHidden();
  const mark = page.locator(".spine .mark");
  const before = await mark.boundingBox();
  await page.evaluate(() => window.scrollTo(0, 2400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(2000);
  expect((await mark.boundingBox()).y).toBeCloseTo(before.y, 0);
});

// the owner found the spine's own scrollbar confusing (6.10): it fits instead, the four facts
// keeping only their heads on a short window and stepping aside on a shorter one
test("on a desktop the spine fits the window without a scrollbar of its own, down to 480 px tall", async ({ page }) => {
  for (const [w, h, keys] of [[1440, 900, "all"], [1440, 760, "all"], [1440, 680, "heads"], [1180, 640, "heads"], [1440, 560, "none"], [1180, 480, "none"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(HOME);
    const got = await page.evaluate(() => {
      const s = document.querySelector(".spine-in"), k = document.querySelector(".keys");
      const shown = getComputedStyle(k).display === "none" ? "none" : getComputedStyle(k.querySelector("li > span")).display === "none" ? "heads" : "all";
      return { over: s.scrollHeight - s.clientHeight, keys: shown, signup: s.querySelector(".spine-end .btn").getBoundingClientRect().bottom <= window.innerHeight };
    });
    expect(got, `${w}x${h}`).toEqual({ over: 0, keys, signup: true });
  }
});

test("on a phone the spine is a green bar: its menu opens the links, and a link or Escape closes them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" }); // jump to the anchor at once, to measure it
  await page.goto(HOME);
  const menu = page.getByRole("button", { name: "תפריט" }), sheet = page.locator("#sheet");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("navigation", { name: "ראשי" })).toBeHidden();
  await expect(page.locator(".spine-end").getByRole("link", { name: "להרשמה חינם" })).toBeVisible();

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: "כמה זה מדויק" }).click();
  await expect(sheet).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#accuracy$/);
  // the sticky bar does not cover the heading it jumped to
  const bar = await page.locator(".spine").boundingBox(), h = await page.locator("#h-acc").boundingBox();
  expect(h.y).toBeGreaterThanOrEqual(bar.y + bar.height);

  await menu.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(menu).toBeFocused();
});

/* The phone menu says it is open (aria-expanded), so it closes the ways a popup does: its button,
   Escape, a link in it, and a press anywhere else. After a press elsewhere it stayed open, and the
   bar, sticky, carried the open sheet down the page over a third of the screen (review of 6.10).
   landing.js runs it on every page of the site. The press goes on to what it was on: a link below
   the open sheet is still followed. */
for (const p of ["index.html", "privacy.html", "terms.html", "accessibility.html", "login.html", "404.html"])
  test(`the phone menu closes on a press outside it, and not on one inside it (${p})`, async ({ page }) => {
    await siteAtRoot(page);
    await page.route(PROJECT + "/**", (route) => route.fulfill({ json: {} }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/site/" + p);
    const menu = page.getByRole("button", { name: "תפריט" }), sheet = page.locator("#sheet");
    await menu.click();
    await expect(sheet).toBeVisible();
    // inside the sheet, below its last link: it stays open
    const inside = await sheet.evaluate((s) => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 4 }; });
    expect(await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!e && e.id === "sheet"; }, inside)).toBe(true);
    await page.mouse.click(inside.x, inside.y);
    await expect(sheet).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    // the page's heading, below the sheet: it closes, and the button says so
    await page.locator("h1:visible").first().click();
    await expect(sheet).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    // the button still opens and closes it
    await menu.click();
    await expect(sheet).toBeVisible();
    await menu.click();
    await expect(sheet).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    if (p !== "index.html") return;
    // a link below the open sheet: followed, and the sheet closes
    await menu.click();
    await page.getByRole("link", { name: "לראות איך זה עובד" }).click();
    await expect(page).toHaveURL(/#how$/);
    await expect(sheet).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

for (const width of [1440, 1180, 860, 390, 320])
  test(`nothing is cut or scrolls sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(HOME);
    expect(await cutOff(page)).toEqual([]);
  });

test("reduced motion: no smooth scrolling and no transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(HOME);
  const css = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    moving: [".nm", ".al", ".btn", ".faq summary"].map((s) => getComputedStyle(document.querySelector(s)).transitionDuration)
      .concat(getComputedStyle(document.querySelector(".faq summary"), "::after").transitionDuration),
  }));
  expect(css.scroll).toBe("auto");
  expect(css.moving.filter((d) => d.split(",").some((x) => parseFloat(x) > 0))).toEqual([]);
});

for (const [where, width] of [["desktop", 1440], ["phone", 390]])
  test(`WCAG 2.1 AA by axe (${where})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(HOME);
    await axe(page, where);
    await page.locator(".faq details").first().locator("summary").click();
    if (where === "phone") await page.getByRole("button", { name: "תפריט" }).click();
    await axe(page, where + ", a question and the menu open");
  });

for (const p of ["privacy.html", "terms.html", "accessibility.html", "404.html", "login.html"])
  test(`${p} has the home page's frame: the spine, its phone menu, nothing cut at 320 px, and axe`, async ({ page }) => {
    await siteAtRoot(page);
    await page.route(PROJECT + "/**", (route) => route.fulfill({ json: {} }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/site/" + p);
    await expect(page.getByRole("navigation", { name: "ראשי" })).toBeVisible();
    await axe(page, p + " at 1440");
    await page.setViewportSize({ width: 320, height: 800 });
    const menu = page.getByRole("button", { name: "תפריט" });
    await menu.click();
    await expect(page.locator("#sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#sheet")).toBeHidden();
    await expect(menu).toBeFocused();
    expect(await cutOff(page)).toEqual([]);
    await axe(page, p + " at 320");
  });

test("the sign-in page is marked as the current page, in the spine and in the phone menu", async ({ page }) => {
  await page.route(PROJECT + "/**", (route) => route.fulfill({ json: {} }));
  await page.goto("/site/login.html");
  await expect(page.locator('.spine-end a[aria-current="page"]')).toHaveText("כניסה");
  await expect(page.locator('#sheet a[aria-current="page"]')).toHaveText("כניסה");
  await expect(page.locator("[aria-current]")).toHaveCount(2);
});

/* Cloudflare serves the sign-in page as /login too: sending an emailed link on from there, to
   /login.html, which redirects to /login, would never end. login.js clears #confirm and #error
   at once, but a sign-in link's #access_token stays until Supabase's client reads it, later. */
for (const link of ["#confirm=abc&type=signup", "#access_token=abc&token_type=bearer&expires_in=3600&type=magiclink"])
  test(`the sign-in page reads an emailed link itself, even at its short address, and never sends it on (${link.split("=")[0]})`, async ({ page }) => {
    await page.route(PROJECT + "/**", (route) => route.fulfill({ json: {} }));
    await page.route("**/site/login", (route) => route.fulfill({ path: path.join(SITE, "login.html") }));
    await page.goto("/site/login" + link);
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname).toBe("/site/login");
  });
