const { test, expect } = require("./base");
const H = require("./helpers");
const AxeBuilder = require("@axe-core/playwright").default;
const path = require("path");
const { build } = require("../scripts/build-hosted.js");

/* The hosted tool as the hosted build makes it (scripts/build-hosted.js into dist/, served here
   at /dist/; site/cloud.js in its page), against a stand-in for Supabase. What it pins:
   - the text-free log goes up once per document, when it ends, and only what is new;
   - nothing goes up while the user's switch is off, nor for an hour after the server answers that
     a limit is reached (429); any other refusal is about that one log;
   - signing out and deleting the account end the session and the gate's cookie;
   - without a session the tool sends the person to sign in;
   - the public tool, without the injection, never talks to the project at all. */

const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const APP = "/dist/app/index.html";
test.beforeAll(() => { build(path.join(__dirname, "..", "dist")); });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "00000000-0000-0000-0000-00000000000a", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"].join(".");
const SESSION = { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r1",
  user: { id: "00000000-0000-0000-0000-00000000000a", aud: "authenticated", role: "authenticated", email: "a@example.co.il" } };
const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה."].join("\n");

/* The account as the server holds it: the answers change it as migration 0007 does (a "not now"
   counts only while there is no answer, and the second is a no). Two tabs share one with
   { server: calls.row }. */
async function hosted(page, { session = true, logOn = true, state = {}, server = null, submitStatus = 204 } = {}) {
  const calls = [];
  const row = server || { email: "a@example.co.il", full_name: "Alpha", log_enabled: logOn, log_asks: 0, approved: true, blocked: false, ...state };
  calls.row = row;
  await page.route(PROJECT + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ path: u.pathname, query: u.search, body, keepalive: false, at: Date.now() });
    if (u.pathname === "/auth/v1/user") return route.fulfill({ json: SESSION.user });
    if (u.pathname === "/rest/v1/profiles") return route.fulfill({ json: /object/.test(req.headers().accept || "") ? { ...row } : [{ ...row }] });
    if (u.pathname === "/rest/v1/rpc/set_log_enabled") row.log_enabled = body.p_on;
    if (u.pathname === "/rest/v1/rpc/log_not_now" && row.log_enabled === null) { row.log_asks += 1; row.log_enabled = row.log_asks >= 2 ? false : null; }
    // a refused log, as PostgREST answers it: 429 is a limit reached (migration 0009), 400 anything else
    if (u.pathname === "/rest/v1/rpc/submit_log" && submitStatus !== 204) {
      const limit = submitStatus === 429;
      return route.fulfill({ status: submitStatus, json: { code: limit ? "PT429" : "P0001", message: limit ? "log budget used up for today: try again tomorrow" : "log too large", details: null, hint: null } });
    }
    return route.fulfill({ status: u.pathname.startsWith("/rest/v1/rpc/") ? 204 : 200, body: "" });
  });
  // where the account panel sends people: stand-ins, so a test ends where it lands
  await page.route("**/dist/login.html", (route) => route.fulfill({ contentType: "text/html", body: "<title>login</title>" }));
  await page.route(/\/dist\/$/, (route) => route.fulfill({ contentType: "text/html", body: "<title>home</title>" }));
  if (session) await page.addInitScript((s) => { if (!window.sessionStorage.getItem("seeded")) { localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify(s)); window.sessionStorage.setItem("seeded", "1"); } }, SESSION);
  return calls;
}
const submits = (calls) => calls.filter((c) => c.path === "/rest/v1/rpc/submit_log");
// the account button is the top bar's own, shown, right after the day/night button, and the only
// «חשבון» on the screen; its panel is laid under it (and exists once)
const inTopBar = (page) => page.evaluate(() => {
  const b = document.querySelector("header [data-ink-account]"), box = document.querySelectorAll("#ink-account");
  const shown = [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "חשבון" && x.getClientRects().length && getComputedStyle(x).visibility === "visible");
  if (!b || box.length !== 1 || shown.length !== 1 || shown[0] !== b || !b.previousElementSibling || !b.previousElementSibling.matches("[data-night]")) return false;
  const r = b.getBoundingClientRect(), p = box[0].getBoundingClientRect();
  return Math.abs(r.left - p.left) < 2 && Math.abs(r.top - p.top) < 2;
});
// the built tool, past its onboarding (as H.boot does for the public one)
async function boot(page) {
  await page.addInitScript(() => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} });
  await page.goto(APP);
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.getByText("לפני שמתחילים")).toHaveCount(0);
}

async function runDoc(page, name, doc = DOC) {
  await H.upload(page, name, doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
// "new document" may first ask about the case profile, saved in this browser only: yes, leave
const newDoc = async (page) => { page.once("dialog", (d) => d.accept()); await page.getByRole("button", { name: "מסמך חדש", exact: true }).click(); await expect(page.locator("[data-bar]")).toHaveCount(0); };

test.beforeEach(async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.addInitScript(() => { window.__ner = { names: () => [], cached: true }; });
});

test("signed in: the account panel, the visit marked, the gate's cookie written", async ({ page }) => {
  const calls = await hosted(page);
  await boot(page);
  await expect(page.getByRole("button", { name: "חשבון", exact: true })).toBeVisible();
  // in the top bar, beside the day/night button
  await expect.poll(() => inTopBar(page)).toBe(true);
  expect(calls.some((c) => c.path === "/rest/v1/rpc/touch")).toBe(true);
  expect((await page.context().cookies()).find((c) => c.name === "ink_at").value).toBe(JWT);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await expect(page.locator("#ink-account-panel")).toContainText("a@example.co.il");
  await expect(page.getByLabel(/שליחת יומן שימוש/)).toBeChecked();
  // Escape closes it and puts the focus back on the button
  await page.getByLabel(/שליחת יומן שימוש/).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("#ink-account-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "חשבון", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "חשבון", exact: true })).toHaveAttribute("aria-expanded", "false");
});

// where the focus is: the account button (or inside its panel), the top bar, the day/night button
const focusAt = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { account: !!(a && (a.closest("#ink-account") || a.closest("[data-ink-account]"))), header: !!(a && a.closest("header")), night: !!(a && a.matches("[data-night]")),
    below: !!a && a === window.__below, name: a ? (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().replace(/\s+/g, " ").slice(0, 30) : "" };
});
// Tab from the top of the page until the account button: where each stop before it was
async function tabsToAccount(page) {
  await page.evaluate(() => { window.scrollTo(0, 0); const b = document.body; b.tabIndex = -1; b.focus(); b.removeAttribute("tabindex"); });
  const before = [];
  for (let i = 0; i < 250; i++) {
    await page.keyboard.press("Tab");
    const at = await focusAt(page);
    if (at.account) return before;
    before.push(at);
  }
  return null;
}
// the page's first Tab stop below the top bar, in the document's order (kept as window.__below)
const firstBelowBar = (page) => page.evaluate(() => {
  const head = document.querySelector("header");
  window.__below = [...document.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex]")].find((e) => !e.disabled && e.tabIndex >= 0
    && e.getClientRects().length && getComputedStyle(e).visibility === "visible" && !head.contains(e) && !e.closest("#ink-account")
    && !!(head.compareDocumentPosition(e) & window.Node.DOCUMENT_POSITION_FOLLOWING)) || null;
  return window.__below ? (window.__below.getAttribute("aria-label") || window.__below.textContent || window.__below.tagName).trim().slice(0, 30) : null;
});
// the top bar's buttons as a screen reader meets them, in order
const barButtons = (page) => page.getByRole("banner").getByRole("button").evaluateAll((bs) => bs.map((b) => (b.getAttribute("aria-label") || b.textContent).trim()));

/* The account button sits last in the top bar, right after the day/night button, and Tab and a
   screen reader reach it there. Appended to the page it came after every control on the screen (the
   live check of 6.10); laid over the bar from just before the tool's page (2996c84) it was the
   page's first Tab stop, before the bar's steps and «החזרת שמות מתשובת AI», and was read before the
   tool's name (review of 6.10). So: the stop right before it is the day/night button, the one right
   after it is the page's first below the bar, Shift+Tab goes back the same way, and in the banner it
   is read right after the day/night button. Its panel stays outside the tool's page (the page
   engine copies whatever is put inside what it draws). */
test("Tab reaches the account button right after the day/night button, and goes on below the bar", async ({ page }) => {
  await hosted(page);
  await boot(page);
  await expect.poll(() => inTopBar(page)).toBe(true);
  const outside = () => page.evaluate(() => { const box = document.getElementById("ink-account"), root = document.getElementById("dc-root");
    return !!box && !!root && !root.contains(box); });
  for (const screen of ["first", "review"]) {
    // the review screen has the most controls
    if (screen === "review") await runDoc(page, "one.docx");
    const before = await tabsToAccount(page);
    expect(before && before.length, screen).toBeGreaterThan(0);
    expect(before.filter((s) => !s.header).map((s) => s.name), screen + ": every stop before it is in the top bar").toEqual([]);
    expect(before[before.length - 1].night, screen + ": the stop right before it is the day/night button").toBe(true);
    expect(await firstBelowBar(page), screen).not.toBeNull();
    await page.keyboard.press("Tab");
    expect((await focusAt(page)).below, screen + ": the stop right after it is the page's first below the bar").toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect((await focusAt(page)).account, screen + ": Shift+Tab comes back to it").toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect((await focusAt(page)).night, screen + ": and then to the day/night button").toBe(true);
    const bar = await barButtons(page);
    expect(bar.slice(-2), screen + ": read in the banner right after the day/night button").toEqual(["מצב יום או לילה", "חשבון"]);
    expect(await outside(), screen + ": the panel outside the tool's page").toBe(true);
  }
  await expect.poll(() => inTopBar(page)).toBe(true);
  // open, its panel comes next: Tab goes through it, though it sits outside the page, and then on below the bar
  await firstBelowBar(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ink-account-panel")).toBeVisible();
  const walk = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    walk.push(await page.evaluate(() => { const a = document.activeElement; return a === window.__below ? "below" : a.closest("#ink-account-panel") ? a.id || a.textContent.trim() : "elsewhere"; }));
  }
  expect(walk).toEqual(["ink-log", "מה נשלח ביומן", "יציאה מהחשבון", "מחיקת החשבון", "below"]);
  // and Shift+Tab from its first stop goes back to the button
  await page.locator("#ink-log").focus();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement.matches("header [data-ink-account]"))).toBe(true);
});

/* A press anywhere outside the open panel closes it, as a menu does, and the button says so; a press
   inside it does not (the live check of 6.10: it stayed open, aria-expanded still true). */
test("the account panel closes on a press outside it, and not on one inside it", async ({ page }) => {
  await hosted(page);
  await boot(page);
  const btn = page.getByRole("button", { name: "חשבון", exact: true }), pane = page.locator("#ink-account-panel");
  await btn.click();
  await expect(pane).toBeVisible();
  await pane.getByText("a@example.co.il").click();
  await expect(pane).toBeVisible();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  // the tool's name in the top bar: a press that does nothing else
  await page.locator("header [data-wordmark]").click();
  await expect(pane).toBeHidden();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  // and elsewhere on the page, after opening it again
  await btn.click();
  await expect(pane).toBeVisible();
  await page.mouse.click(700, 500);
  await expect(pane).toBeHidden();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  // the button itself still opens and closes it
  await btn.click();
  await expect(pane).toBeVisible();
  await btn.click();
  await expect(pane).toBeHidden();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
});

/* An open panel that the focus leaves closes, and its button says so: Tab past its last stop, or back
   past its button, left it open over the page, aria-expanded still true, the next stops under it
   (review of 6.10; WCAG 2.4.11, focus not hidden). Moving inside it, or between it and its button,
   keeps it open. */
test("the account panel closes when the focus leaves it, and not while it moves inside it", async ({ page }) => {
  await hosted(page);
  await boot(page);
  const btn = page.getByRole("button", { name: "חשבון", exact: true }), pane = page.locator("#ink-account-panel");
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(pane).toBeVisible();
  // through its four stops and back to the button: still open
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "מחיקת החשבון" })).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+Tab");
  await expect(btn).toBeFocused();
  await expect(pane).toBeVisible();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  // on past its last stop: closed, and nothing covers the stop the focus reached
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  await expect(pane).toBeHidden();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!at && !!a.closest("#dc-root") && !a.closest("header") && (a === at || a.contains(at)); })).toBe(true);
  // back past its button, to the day/night button: closed
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(pane).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("header [data-night]")).toBeFocused();
  await expect(pane).toBeHidden();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
});

test("on a phone, the account button sits on the header's first row, in the header's colours", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hosted(page);
  await boot(page);
  await expect.poll(() => inTopBar(page)).toBe(true);
  // the tool's header wraps on a phone (v60): the name and the day/night button share the first row,
  // and the account button joins them rather than taking a row of its own
  const night = await page.locator("header [data-night]").boundingBox();
  const slot = await page.locator("header [data-ink-account]").boundingBox();
  const name = await page.locator("header [data-wordmark]").boundingBox();
  expect(Math.abs(slot.y - night.y)).toBeLessThan(2);
  expect(slot.y).toBeLessThan(name.y + name.height);
  expect((await page.locator("header").boundingBox()).height).toBeLessThan(140);
  // the bar is bookcloth green: cream text on it, not a white button
  const look = await page.getByRole("button", { name: "חשבון", exact: true }).evaluate((b) => { const s = getComputedStyle(b); return [s.color, s.backgroundColor]; });
  expect(look).toEqual(["rgb(237, 230, 204)", "rgba(0, 0, 0, 0)"]);
});

test("each document's log goes up once when it ends, only what is new, with no text", async ({ page }) => {
  const calls = await hosted(page);
  await boot(page);
  await runDoc(page, "one.docx");
  expect(submits(calls)).toHaveLength(0);
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  const first = submits(calls)[0].body;
  expect(first.p_log.events.some((e) => e.ev === "run")).toBe(true);
  expect(first.p_leaks).toBe(null);
  expect(JSON.stringify(first)).not.toMatch(/[֐-׿]/);
  // leaving the start screen without another document sends nothing more
  await page.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent("pagehide")));
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(1);
  // the next document's upload carries only its own events
  await runDoc(page, "two.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(2);
  // the tool redrew its header between screens: the account button is still in the top bar, once
  await expect.poll(() => inTopBar(page)).toBe(true);
  await expect(page.getByRole("button", { name: "חשבון", exact: true })).toHaveCount(1);
  const lastT = Math.max(...first.p_log.events.map((e) => e.t));
  expect(submits(calls)[1].body.p_log.events.every((e) => e.t > lastT)).toBe(true);
  // each upload says where its slice starts, so a report times it from there
  expect(first.p_log.from).toBe(0);
  expect(submits(calls)[1].body.p_log.from).toBe(lastT);
});

test("past the server's limit for logs (429), nothing goes up for an hour, and nothing is shown", async ({ page }) => {
  const calls = await hosted(page, { submitStatus: 429 });
  await boot(page);
  await runDoc(page, "one.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  await runDoc(page, "two.docx");
  await newDoc(page);
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(1);
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  await expect(page.locator("#ink-account-msg")).toHaveText("");
});

/* The limits are windows of an hour and a day: a tab left open all day tries again after the hour,
   with the next document's own log only (the clock jumps 61 minutes; the token is renewed as in
   the long-pause test below). */
test("an hour after a 429, the next document's log goes up again, without the hour's documents", async ({ page }) => {
  const NEW = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: SESSION.user.id, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 7200, n: 2 }), "sig2"].join(".");
  await page.clock.install();
  const calls = await hosted(page, { submitStatus: 429 });
  await page.route(PROJECT + "/auth/v1/token**", (route) => route.fulfill({ json: { ...SESSION, access_token: NEW, refresh_token: "r2", expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200 } }));
  await boot(page);
  await runDoc(page, "one.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  await runDoc(page, "two.docx");
  await newDoc(page);
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(1);
  await page.clock.setSystemTime(Date.now() + 61 * 60 * 1000);
  await runDoc(page, "three.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(2);
  // it starts after the second document, passed over in the hour, and carries the third, whose
  // times (counted from the page's start) come after the jump
  const first = submits(calls)[0].body.p_log, second = submits(calls)[1].body.p_log;
  expect(second.from).toBeGreaterThan(Math.max(...first.events.map((e) => e.t)));
  expect(second.events.some((e) => e.ev === "run" && e.t > 60 * 60 * 1000)).toBe(true);
});

test("any other refusal is about that one log: the next document's still goes up", async ({ page }) => {
  const calls = await hosted(page, { submitStatus: 400 });
  await boot(page);
  await runDoc(page, "one.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  await runDoc(page, "two.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(2);
});

test("with the switch off, nothing goes up", async ({ page }) => {
  const calls = await hosted(page);
  await boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await page.getByLabel(/שליחת יומן שימוש/).uncheck();
  await expect.poll(() => calls.find((c) => c.path === "/rest/v1/rpc/set_log_enabled")?.body).toEqual({ p_on: false });
  await expect(page.locator("#ink-account-msg")).toContainText("לא יישלח");
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await runDoc(page, "one.docx");
  await newDoc(page);
  await page.waitForTimeout(800);
  expect(submits(calls)).toHaveLength(0);
});

test("a switch already off on the server is respected from the start", async ({ page }) => {
  const calls = await hosted(page, { logOn: false });
  await boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await expect(page.getByLabel(/שליחת יומן שימוש/)).not.toBeChecked();
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await runDoc(page, "one.docx");
  await newDoc(page);
  await page.waitForTimeout(800);
  expect(submits(calls)).toHaveLength(0);
});

test("signing out ends the session and the cookie, and goes to sign-in", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const calls = await hosted(page);
  await boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await page.getByRole("button", { name: "יציאה מהחשבון" }).click();
  await page.waitForURL("**/login.html");
  // this browser only (review 4.10): the account's other devices stay signed in
  const out = calls.find((c) => c.path === "/auth/v1/logout");
  expect(out && out.query).toContain("scope=local");
  expect((await page.context().cookies()).find((c) => c.name === "ink_at")).toBeUndefined();
});

test("a file the gate answered with the sign-in page is asked for again after renewing, and a missing cookie is written again", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const calls = await hosted(page);
  const NEW = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "00000000-0000-0000-0000-00000000000a", role: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }), "renewed"].join(".");
  await page.route(PROJECT + "/auth/v1/token**", (route) => { calls.push({ path: "/auth/v1/token" }); route.fulfill({ json: { ...SESSION, access_token: NEW, refresh_token: "r2" } }); });
  let asked = 0;
  // the gate refuses the first time (its token had ended, whatever this computer's clock said)
  await page.route("**/dist/app/probe.txt", (route) => (++asked === 1 ? route.fulfill({ status: 302, headers: { location: "/dist/login.html" } }) : route.fulfill({ body: "the file" })));
  await boot(page);
  expect(await page.evaluate(() => fetch("./probe.txt").then((r) => r.text()))).toBe("the file");
  expect(asked).toBe(2);
  expect(calls.filter((c) => c.path === "/auth/v1/token")).toHaveLength(1);
  // the gate cleared the cookie (or another tab replaced it): the next request writes it again
  await page.context().clearCookies({ name: "ink_at" });
  const sent = page.waitForRequest((r) => r.url().endsWith("/dist/app/hosted-resources.js?again"));
  await page.evaluate(() => fetch("./hosted-resources.js?again").catch(() => {}));
  expect((await (await sent).allHeaders()).cookie || "").toContain("ink_at=" + NEW);
});

test("deleting the account asks first, deletes, and leaves for the home page", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const calls = await hosted(page);
  await boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  let asked = "";
  page.once("dialog", (d) => { asked = d.message(); d.dismiss(); });
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  await expect.poll(() => asked).toContain("למחוק את החשבון");
  expect(calls.some((c) => c.path === "/rest/v1/rpc/delete_my_account")).toBe(false);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  await page.waitForURL(/\/dist\/$/);
  expect(calls.some((c) => c.path === "/rest/v1/rpc/delete_my_account")).toBe(true);
  expect((await page.context().cookies()).find((c) => c.name === "ink_at")).toBeUndefined();
});

/* The message of a deletion that failed tells the person to write to the contact address, so the
   address is a link to write to it, in the same words (review of 6.10: it was plain text, as the
   sign-in page's were before e65ddc5). */
test("a deletion that failed says so in the same words, and its contact address is a link to write to", async ({ page }) => {
  const calls = await hosted(page);
  await page.route(PROJECT + "/rest/v1/rpc/delete_my_account", (route) => route.fulfill({ status: 500, json: { code: "XX000", message: "failed", details: null, hint: null } }));
  await boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  const msg = page.locator("#ink-account-msg");
  await expect(msg).toHaveText("המחיקה לא הצליחה. אפשר לנסות שוב, או לכתוב אל contact@inkognito.co.il.");
  await expect(msg.getByRole("link", { name: "contact@inkognito.co.il", exact: true })).toHaveAttribute("href", "mailto:contact@inkognito.co.il");
  // still here, still signed in, the panel open with the message (read out: role=status)
  await expect(msg).toHaveAttribute("role", "status");
  await expect(page.locator("#ink-account-panel")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(APP);
  expect(calls.some((c) => c.path === "/auth/v1/logout")).toBe(false);
  const r = await new AxeBuilder({ page }).include("#ink-account").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test("without a session the tool sends the person to sign in", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  await hosted(page, { session: false });
  await page.goto(APP);
  await page.waitForURL("**/login.html");
});

test("the public tool, without the hosted injection, never talks to the project", async ({ page }) => {
  const calls = [];
  await page.route(PROJECT + "/**", (route) => { calls.push(route.request().url()); route.abort(); });
  await H.boot(page);
  await runDoc(page, "one.docx");
  await newDoc(page);
  await page.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent("pagehide")));
  await page.waitForTimeout(500);
  expect(calls).toEqual([]);
  expect(await page.evaluate(() => "__inkHost" in window)).toBe(false);
});

// copy the redacted text to the AI: the moment the tool calls docSent. With items still open the
// tool asks first ("להעתיק בכל זאת"), as for any user; the test answers it.
async function sendDoc(page) {
  await page.evaluate(() => { window.__copied = ""; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל-AI|הועתק/ }).click();
  const anyway = page.getByRole("button", { name: "להעתיק בכל זאת" });
  if (await anyway.isVisible({ timeout: 1500 }).catch(() => false)) await anyway.click();
  await expect.poll(() => page.evaluate(() => (window.__copied || "").length)).toBeGreaterThan(0);
}

test("not asked yet: the first sent document asks; yes sends the whole log, the first document included", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  await boot(page);
  await runDoc(page, "one.docx");
  await sendDoc(page);
  const card = page.locator("#ink-ask");
  await expect(card).toBeVisible();
  await expect(page.locator("#ink-ask-h")).toBeFocused();
  expect(submits(calls)).toHaveLength(0);
  await card.getByText("מה בדיוק נשלח?").click();
  const sample = await card.locator("pre").innerText();
  expect(sample).toContain('"run"');
  expect(sample).not.toMatch(/[֐-׿]/);
  const r = await new AxeBuilder({ page }).include("#ink-ask").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await card.getByRole("button", { name: "כן, לשלוח" }).click();
  await expect(card).toHaveCount(0);
  expect(calls.find((c) => c.path === "/rest/v1/rpc/set_log_enabled").body).toEqual({ p_on: true });
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  expect(submits(calls)[0].body.p_log.events.some((e) => e.ev === "run")).toBe(true);
  expect(submits(calls)[0].body.p_log.from).toBe(0);
});

test("not now: nothing goes up and the card does not come back for the next documents", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  await boot(page);
  await runDoc(page, "one.docx");
  await sendDoc(page);
  await page.locator("#ink-ask").getByRole("button", { name: "לא עכשיו" }).click();
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  await expect.poll(() => calls.filter((c) => c.path === "/rest/v1/rpc/log_not_now").length).toBe(1);
  await newDoc(page);
  await runDoc(page, "two.docx");
  await sendDoc(page);
  await page.waitForTimeout(500);
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  await newDoc(page);
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(0);
});

test("after one not-now, the fifth sent document asks again, and a second not-now is a no", async ({ page }) => {
  const calls = await hosted(page, { logOn: null, state: { log_asks: 1 } });
  await page.addInitScript((id) => { if (!localStorage.getItem("ink-sent:" + id)) localStorage.setItem("ink-sent:" + id, "3"); }, SESSION.user.id);
  await boot(page);
  await runDoc(page, "four.docx");
  await sendDoc(page);
  await page.waitForTimeout(500);
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  await newDoc(page);
  await runDoc(page, "five.docx");
  await sendDoc(page);
  await expect(page.locator("#ink-ask")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  await expect.poll(() => calls.filter((c) => c.path === "/rest/v1/rpc/log_not_now").length).toBe(1);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await expect(page.getByLabel(/שליחת יומן שימוש/)).not.toBeChecked();
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await newDoc(page);
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(0);
});

/* A refusal reaches back (review 5.10): what is done while the answer is "not now" or no never goes
   up, not even after a later yes. Only a first yes, with no answer before it, sends the page load
   from its start. The moments are taken on the page's clock, which the log's times count on. */
const pageNow = (page) => page.evaluate(() => Date.now());
async function panelSwitch(page, on) {
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  const before = await pageNow(page);
  if (on) await page.getByLabel(/שליחת יומן שימוש/).check(); else await page.getByLabel(/שליחת יומן שימוש/).uncheck();
  await expect(page.locator("#ink-account-msg")).toContainText(on ? "יישלח בסוף" : "לא יישלח");
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  return before;
}
// nothing in an upload from at or before a moment
const allAfter = (sub, moment) => {
  const cut = moment - Date.parse(sub.body.p_log.started);
  return sub.body.p_log.events.every((e) => e.t > cut) && sub.body.p_log.from >= cut;
};

test("switched off and on again: what was done while it was off never goes up", async ({ page }) => {
  const calls = await hosted(page);
  await boot(page);
  await runDoc(page, "one.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  await panelSwitch(page, false);
  await runDoc(page, "private.docx");
  await sendDoc(page);
  await newDoc(page);
  const on = await panelSwitch(page, true);
  await runDoc(page, "three.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(2);
  expect(allAfter(submits(calls)[1], on)).toBe(true);
});

test("a no from an earlier visit, then switched on: only what comes after the yes goes up", async ({ page }) => {
  const calls = await hosted(page, { logOn: false, state: { log_asks: 2 } });
  await boot(page);
  await runDoc(page, "private.docx");
  const on = await panelSwitch(page, true);
  // the document worked on under the no ends after the yes: none of it goes up
  await newDoc(page);
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(0);
  await runDoc(page, "two.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  expect(allAfter(submits(calls)[0], on)).toBe(true);
});

test("not now, then a yes from the panel: only what comes after the yes goes up", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  await boot(page);
  await runDoc(page, "one.docx");
  await sendDoc(page);
  await page.locator("#ink-ask").getByRole("button", { name: "לא עכשיו" }).click();
  await expect.poll(() => calls.row.log_asks).toBe(1);
  await newDoc(page);
  await runDoc(page, "two.docx");
  const on = await panelSwitch(page, true);
  await newDoc(page);
  await runDoc(page, "three.docx");
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  await page.waitForTimeout(500);
  expect(submits(calls)).toHaveLength(1);
  expect(allAfter(submits(calls)[0], on)).toBe(true);
});

test("the switch answers an open card: the card closes, and a first yes there sends the page load", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  await boot(page);
  await runDoc(page, "one.docx");
  await sendDoc(page);
  await expect(page.locator("#ink-ask")).toBeVisible();
  await panelSwitch(page, true);
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  expect(calls.filter((c) => c.path === "/rest/v1/rpc/log_not_now")).toHaveLength(0);
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  expect(submits(calls)[0].body.p_log.from).toBe(0);
});

test("after a not-now, counting goes on in the same page load, once per document", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  const k = "ink-sent:" + SESSION.user.id;
  await boot(page);
  await runDoc(page, "one.docx");
  await sendDoc(page);
  await page.locator("#ink-ask").getByRole("button", { name: "לא עכשיו" }).click();
  await expect.poll(() => calls.row.log_asks).toBe(1);
  await newDoc(page);
  // documents two and three, as if sent
  await page.evaluate((key) => localStorage.setItem(key, "3"), k);
  // the fourth, copied twice: one count, no card
  await runDoc(page, "four.docx");
  await sendDoc(page);
  await sendDoc(page);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), k)).toBe("4");
  await expect(page.locator("#ink-ask")).toHaveCount(0);
  await newDoc(page);
  // the fifth asks again, in the same page load
  await runDoc(page, "five.docx");
  await sendDoc(page);
  await expect(page.locator("#ink-ask")).toBeVisible();
});

test("two tabs: after a yes in one, a not-now on the other's card keeps the account's yes", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  const other = await page.context().newPage();
  await H.serveEngineWithStub(other);
  await other.addInitScript(() => { window.__ner = { names: () => [], cached: true }; });
  const callsB = await hosted(other, { server: calls.row });
  await boot(other);
  await runDoc(other, "b.docx");
  await sendDoc(other);
  await expect(other.locator("#ink-ask")).toBeVisible();
  await boot(page);
  await runDoc(page, "a.docx");
  await sendDoc(page);
  await page.locator("#ink-ask").getByRole("button", { name: "כן, לשלוח" }).click();
  await expect.poll(() => calls.row.log_enabled).toBe(true);
  await other.locator("#ink-ask").getByRole("button", { name: "לא עכשיו" }).click();
  // the server kept the yes; the other tab now shows it, and its next document goes up
  await expect.poll(() => calls.row.log_enabled).toBe(true);
  await other.getByRole("button", { name: "חשבון", exact: true }).click();
  await expect(other.getByLabel(/שליחת יומן שימוש/)).toBeChecked();
  await other.getByRole("button", { name: "חשבון", exact: true }).click();
  await newDoc(other);
  await runDoc(other, "b2.docx");
  await newDoc(other);
  await expect.poll(() => submits(callsB).length).toBe(1);
  await other.close();
});

// select a word on the check screen and mark it as a person, as in e2e/leak.spec.js
async function markByHand(page, word) {
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).toContainText(word);
  await page.evaluate((w) => {
    const root = document.querySelector("[data-work] section");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) { const i = node.textContent.indexOf(w); if (i >= 0) {
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + w.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      node.parentElement.closest("[onmouseup], div").dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); break; } }
  }, word);
  const popup = page.locator("[data-popup]");
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "אדם", exact: true }).click();
  await expect(sheet).not.toContainText(word);
}

test("the card names the report on missed names, links the details, and its sample shows the report", async ({ page }) => {
  const calls = await hosted(page, { logOn: null });
  await boot(page);
  await runDoc(page, "one.docx", DOC + "\nהשכן קרבוטינסקי הגיע באיחור.");
  await markByHand(page, "קרבוטינסקי");
  await sendDoc(page);
  const card = page.locator("#ink-ask");
  await expect(card).toContainText("שם שהכלי פספס");
  await expect(card.getByRole("link", { name: "הפירוט המלא" })).toHaveAttribute("href", /privacy\.html$/);
  await card.getByText("מה בדיוק נשלח?").click();
  const sample = JSON.parse(await card.locator("pre").innerText());
  expect(sample.leaks.shapes[0].lens).toEqual([10]);
  expect(JSON.stringify(sample)).not.toMatch(/[֐-׿]{3,}/);
  await card.getByRole("button", { name: "כן, לשלוח" }).click();
  await newDoc(page);
  await expect.poll(() => submits(calls).length).toBe(1);
  expect(submits(calls)[0].body.p_leaks.shapes[0].lens).toEqual([10]);
});

/* A background tab: the browser slows its timers, so supabase-js's own refresh (every 30 s,
   two minutes ahead) comes late, and the token can run out under the page. Here the clock jumps
   58 minutes ahead without any timer firing, and the very next request the tool makes to the
   site must already carry a renewed token: otherwise the gate refuses it (the model's parts, on
   the first scan after a long pause). */
test("after a long pause, the tool's next request to the site carries a renewed token", async ({ page }) => {
  const NEW = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: SESSION.user.id, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 7200, n: 2 }), "sig2"].join(".");
  await page.clock.install();
  const calls = await hosted(page);
  await page.route(PROJECT + "/auth/v1/token**", (route) => { calls.push({ path: "/auth/v1/token" }); route.fulfill({ json: { ...SESSION, access_token: NEW, refresh_token: "r2", expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200 } }); });
  await boot(page);
  expect(calls.filter((c) => c.path === "/auth/v1/token")).toHaveLength(0);
  await page.clock.setSystemTime(Date.now() + 3500 * 1000);
  const sent = page.waitForRequest((r) => r.url().endsWith("/dist/app/hosted-resources.js?probe"));
  await page.evaluate(() => window.fetch("./hosted-resources.js?probe").then((r) => r.status));
  const cookie = (await (await sent).allHeaders()).cookie || "";
  expect(cookie).toContain("ink_at=" + NEW);
  // supabase-js's own 30-second timer may renew in the same moment: two renewals are harmless
  // (Supabase accepts a reused refresh token for a few seconds); what matters is the cookie above
  expect(calls.filter((c) => c.path === "/auth/v1/token").length).toBeGreaterThanOrEqual(1);
});

for (const [why, state] of [["blocked", { blocked: true }], ["pending", { approved: false }]])
  test(`an account that became ${why} is signed out at once, even from a page already open`, async ({ page }) => {
    test.info().annotations.push({ type: "no-self-check" });
    await hosted(page, { state });
    await page.goto(APP);
    await page.waitForURL("**/login.html#error=" + why);
    expect((await page.context().cookies()).find((c) => c.name === "ink_at")).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem("sb-cwsiranjlxbclmaqtucc-auth-token"))).toBe(null);
  });
