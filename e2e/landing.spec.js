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

  // Tab goes from the hero's last link (the demo's, since v68) to the names, in reading order, each with a focus ring
  await page.locator(".hero .actions").getByRole("link", { name: "סיור על מסמך לדוגמה" }).focus();
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
for (const p of ["index.html", "privacy.html", "terms.html", "accessibility.html", "changes.html", "security.html", "help.html", "login.html", "404.html"])
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

/* And when the focus leaves it: Tab past its last link left the sheet open, aria-expanded true, over
   the page the focus went on to (the class of the account panel's, review of 6.10; WCAG 2.4.11).
   Moving through its links keeps it open. */
for (const p of ["index.html", "privacy.html", "terms.html", "accessibility.html", "changes.html", "security.html", "help.html", "login.html", "404.html"])
  test(`the phone menu closes when the focus leaves it, and not while it moves through it (${p})`, async ({ page }) => {
    await siteAtRoot(page);
    await page.route(PROJECT + "/**", (route) => route.fulfill({ json: {} }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/site/" + p);
    const menu = page.getByRole("button", { name: "תפריט" }), sheet = page.locator("#sheet");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible();
    const links = await sheet.locator("a").count();
    for (let i = 0; i < links; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.getElementById("sheet").contains(document.activeElement))).toBe(true);
    }
    await expect(sheet).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    // on past its last link: closed
    await page.keyboard.press("Tab");
    await expect(sheet).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    // back past its button: closed too
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(sheet).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

for (const width of [1440, 1180, 860, 390, 320])
  test(`nothing is cut or scrolls sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(HOME);
    expect(await cutOff(page)).toEqual([]);
  });

/* A signed-in visitor (a session kept in this browser by supabase-js) finds «לכלי» where «כניסה» was, in the
   bar and in the phone menu, and no sign-up buttons: they have an account (the owner's decision, 6.10). */
for (const p of ["index.html", "privacy.html"])
  test(`signed in: «לכלי» in place of «כניסה», and no sign-up buttons (${p})`, async ({ page }) => {
    const signUps = () => page.locator('a[href*="mode=signup"]:visible');
    await page.goto("/site/" + p);
    await expect(page.locator("a.login")).toHaveText("כניסה");
    expect(await signUps().count()).toBeGreaterThan(0);
    await page.evaluate(() => window.localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify({ access_token: "a", refresh_token: "r" })));
    await page.reload();
    await expect(page.locator("a.login")).toHaveText("לכלי");
    await expect(page.locator("a.login")).toHaveAttribute("href", "/site/app/");
    await expect(page.locator('#sheet a[href="/site/app/"]')).toHaveText("לכלי");
    await expect(signUps()).toHaveCount(0);
    await expect(page.getByRole("link", { name: "כניסה" })).toHaveCount(0);
  });

test("the home page's first screen: the three steps; its footer names who operates it", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator(".hero .steps3 li")).toHaveText([
    "מחליפים שמות: בוחרים מסמך Word או PDF, והשמות שבו מוחלפים בשמות בדויים.",
    "מעתיקים ל־AI: מדביקים את הטקסט ב־ChatGPT או בכלי AI אחר.",
    "מחזירים את השמות: מדביקים את התשובה באינקוגניטו, והשמות האמיתיים חוזרים אליה.",
  ]);
  await expect(page.locator(".foot .who")).toHaveText("אינקוגניטו מופעל על ידי עומר בן דוד, בני רא״ם.");
});

/* The tool's line of care beside the AI links ends with «איך מכבים», a link to #training on the home page
   (v65, 7.10.2026). Arriving there opens that answer: how to turn training off in each AI, with each
   company's own help page, and the contact line under the questions. */
test("a link to #training opens the answer about turning training off, with a part and a help page for each AI", async ({ page }) => {
  await page.goto(HOME + "#training");
  const d = page.locator("details#training");
  await expect(d).toHaveAttribute("open", "");
  await expect(d.locator("summary")).toHaveText("איך מכבים את השימוש בשיחות לאימון");
  await expect(d.locator("h3")).toHaveText(["ב־ChatGPT", "ב־Claude", "ב־Gemini", "ב־Copilot"]);
  for (const host of ["help.openai.com", "privacy.claude.com", "support.google.com", "support.microsoft.com"])
    await expect(d.locator(`a[href^="https://${host}/"]`), host).toHaveCount(1);
  await expect(page.locator(".faq-contact")).toHaveText("שאלה, תקלה או הצעה? כתבו אל contact@inkognito.co.il, ונענה תוך שני ימי עסקים.");
  // and on the same page, a later link to it opens it too
  await d.locator("summary").click();
  await expect(d).not.toHaveAttribute("open", "");
  await page.evaluate(() => { window.location.hash = ""; window.location.hash = "#training"; });
  await expect(d).toHaveAttribute("open", "");
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

for (const p of ["privacy.html", "terms.html", "accessibility.html", "changes.html", "security.html", "help.html", "404.html", "login.html"])
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

/* After signing out the account panel lands on the home page with ?out (cloud.js). The page says once what
   is left in this browser: the saved cases hold the real client names, and on a shared computer they should
   go (the owner's approved words, 7.10.2026). Cases of every account count, named ones once each. */
test("after signing out, the home page offers once to clear the cases in this browser, and clears them all", async ({ page }) => {
  await page.goto(HOME);
  await page.evaluate(() => {
    const c = (name) => ({ v: 1, name, rules: [{ value: "שרה לוי", kind: "NAME", replacement: "דנה רום" }], map: { "שרה לוי": "דנה רום" } });
    window.localStorage.setItem("redact-cases:acct-1", JSON.stringify({ "א נ׳ ב": c("א נ׳ ב"), "ג נ׳ ד": c("ג נ׳ ד") }));
    window.localStorage.setItem("redact-profile-last:acct-2", JSON.stringify(c("")));
    window.localStorage.setItem("redact-theme", "dark");
  });
  await page.goto(HOME + "?out=1");
  const note = page.locator(".out-note");
  await expect(note).toContainText("יצאתם מהחשבון. בדפדפן הזה שמורים 3 תיקים, ובהם השמות האמיתיים. במחשב משותף כדאי למחוק אותם.");
  await expect(page).toHaveURL(/\/site\/index\.html$/);
  await note.getByRole("button", { name: "מחיקה מהדפדפן הזה" }).click();
  await expect(note).toHaveText("התיקים נמחקו מהדפדפן הזה.");
  expect(await page.evaluate(() => Object.keys(window.localStorage).sort())).toEqual(["redact-theme"]);
  // once: a reload says nothing
  await page.reload();
  await expect(note).toHaveCount(0);
});

test("after signing out with one case: the singular, and «להשאיר» keeps it; with none: one line", async ({ page }) => {
  await page.goto(HOME);
  await page.evaluate(() => window.localStorage.setItem("redact-cases", JSON.stringify({ "א נ׳ ב": { v: 1, name: "א נ׳ ב", rules: [] } })));
  await page.goto(HOME + "?out=1");
  const note = page.locator(".out-note");
  await expect(note).toContainText("יצאתם מהחשבון. בדפדפן הזה שמור תיק אחד, ובו השמות האמיתיים. במחשב משותף כדאי למחוק אותו.");
  await note.getByRole("button", { name: "להשאיר" }).click();
  await expect(note).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("redact-cases"))).not.toBeNull();
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(HOME + "?out=1");
  await expect(note).toHaveText("יצאתם מהחשבון.");
  await expect(note.getByRole("button")).toHaveCount(0);
});

/* The page after deleting the account (cloud.js sends there): what was deleted, and what only this browser
   still holds, with a button that clears it all. */
test("the account-deleted page clears everything the tool kept in this browser, and says so", async ({ page }) => {
  await siteAtRoot(page);
  await page.goto("/site/index.html");
  await page.evaluate(async () => {
    window.localStorage.setItem("redact-cases:acct-1", "{}"); window.localStorage.setItem("redact-theme", "dark");
    await (await window.caches.open("transformers-cache")).put("/model.bin", new window.Response("x"));
  });
  await page.goto("/site/deleted.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("החשבון נמחק");
  await expect(page.locator("main")).toContainText("פרטי החשבון וכל יומני השימוש שלו נמחקו.");
  await page.getByRole("button", { name: "מחיקה מהדפדפן הזה" }).click();
  await expect(page.locator("#wipe-done")).toHaveText("המידע נמחק מהדפדפן הזה. קבצים שהורדתם, כמו מסמכים או קובצי תיקים, נשארים בתיקיית ההורדות.");
  await expect(page.locator("#wipe-held")).toBeHidden();
  expect(await page.evaluate(async () => [window.localStorage.length, (await window.caches.keys()).length])).toEqual([0, 0]);
  // nothing left: the page says so instead of offering the button
  await page.reload();
  await expect(page.locator("#wipe-none")).toHaveText("בדפדפן הזה לא נשמר מידע מהכלי.");
  await expect(page.getByRole("button", { name: "מחיקה מהדפדפן הזה" })).toBeHidden();
  await axe(page, "deleted.html");
});

/* The help page («מדריך שימוש», 7.10.2026): the seventeen answers the owner approved, each a heading a
   link can point to, and the contact line at its end. The tool's «עזרה» menu links here. */
test("the help page has the approved questions, each one linkable, and the contact line at its end", async ({ page }) => {
  await page.goto("/site/help.html");
  await expect(page).toHaveTitle("מדריך שימוש · אינקוגניטו");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("מדריך שימוש");
  const qs = page.locator("article h2");
  await expect(qs).toHaveCount(17);
  await expect(qs.first()).toHaveText("מה הכלי עושה, בשני משפטים?");
  await expect(page.locator("#q09 + p")).toContainText("יישוב דתי ביישוב דתי");
  await expect(page.locator("article > p").last()).toHaveText("שאלה, תקלה או הצעה? כתבו אל contact@inkognito.co.il, ונענה תוך שני ימי עסקים.");
  await axe(page, "help.html");
});

// the no-account demo, under the tour's own name, beside the sign-up on the first screen (v68)
test("the home page's first screen leads to the no-account demo", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator(".hero .actions").getByRole("link", { name: "סיור על מסמך לדוגמה" })).toHaveAttribute("href", "demo/");
});
