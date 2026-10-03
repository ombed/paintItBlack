const { test, expect } = require("./base");
const H = require("./helpers");
const fs = require("fs");
const path = require("path");
const { hostedApp } = require("../scripts/hosted.js");

/* The hosted tool (site/cloud.js, put into the page by scripts/hosted.js, the same function the
   hosted build uses) against a stand-in for Supabase. What it pins:
   - the text-free log goes up once per document, when it ends, and only what is new;
   - nothing goes up while the user's switch is off;
   - signing out and deleting the account end the session and the gate's cookie;
   - without a session the tool sends the person to sign in;
   - the public tool, without the injection, never talks to the project at all. */

const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const ROOT = path.join(__dirname, "..");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "00000000-0000-0000-0000-00000000000a", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"].join(".");
const SESSION = { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r1",
  user: { id: "00000000-0000-0000-0000-00000000000a", aud: "authenticated", role: "authenticated", email: "a@example.co.il" } };
const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה."].join("\n");

async function hosted(page, { session = true, logOn = true, state = {} } = {}) {
  const calls = [];
  await page.route(PROJECT + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    calls.push({ path: u.pathname, body: req.postData() ? JSON.parse(req.postData()) : null, keepalive: false });
    if (u.pathname === "/auth/v1/user") return route.fulfill({ json: SESSION.user });
    if (u.pathname === "/rest/v1/profiles") {
      const row = { email: "a@example.co.il", full_name: "Alpha", log_enabled: logOn, approved: true, blocked: false, ...state };
      return route.fulfill({ json: /object/.test(req.headers().accept || "") ? row : [row] });
    }
    return route.fulfill({ status: u.pathname.startsWith("/rest/v1/rpc/") ? 204 : 200, body: "" });
  });
  // the hosted page: the tool's own index.html through the build's injection; the site's files
  // sit one level up, here the server root
  await page.route(/\/index\.html$/, async (route) => route.fulfill({ contentType: "text/html", body: hostedApp(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")) }));
  for (const [from, file] of [["/config.js", "site/config.js"], ["/cloud.js", "site/cloud.js"], [/\/vendor\/supabase-[\d.]+\.js$/, null]])
    await page.route(typeof from === "string" ? "**" + from : from, (route) => {
      const f = file || "site/vendor/" + path.basename(new URL(route.request().url()).pathname);
      route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(ROOT, f), "utf8") });
    });
  await page.route("**/login.html", (route) => route.fulfill({ contentType: "text/html", body: "<title>login</title>" }));
  await page.route(/:4173\/$/, (route) => route.fulfill({ contentType: "text/html", body: "<title>home</title>" }));
  if (session) await page.addInitScript((s) => { if (!window.sessionStorage.getItem("seeded")) { localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify(s)); window.sessionStorage.setItem("seeded", "1"); } }, SESSION);
  return calls;
}
const submits = (calls) => calls.filter((c) => c.path === "/rest/v1/rpc/submit_log");

async function runDoc(page, name) {
  await H.upload(page, name, DOC);
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
  await H.boot(page);
  await expect(page.getByRole("button", { name: "חשבון", exact: true })).toBeVisible();
  expect(calls.some((c) => c.path === "/rest/v1/rpc/touch")).toBe(true);
  expect((await page.context().cookies()).find((c) => c.name === "ink_at").value).toBe(JWT);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await expect(page.locator("#ink-account-panel")).toContainText("a@example.co.il");
  await expect(page.getByLabel(/שליחת יומן שימוש/)).toBeChecked();
});

test("each document's log goes up once when it ends, only what is new, with no text", async ({ page }) => {
  const calls = await hosted(page);
  await H.boot(page);
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
  const lastT = Math.max(...first.p_log.events.map((e) => e.t));
  expect(submits(calls)[1].body.p_log.events.every((e) => e.t > lastT)).toBe(true);
});

test("with the switch off, nothing goes up", async ({ page }) => {
  const calls = await hosted(page);
  await H.boot(page);
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
  await H.boot(page);
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
  await H.boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  await page.getByRole("button", { name: "יציאה מהחשבון" }).click();
  await page.waitForURL("**/login.html");
  expect(calls.some((c) => c.path === "/auth/v1/logout")).toBe(true);
  expect((await page.context().cookies()).find((c) => c.name === "ink_at")).toBeUndefined();
});

test("deleting the account asks first, deletes, and leaves for the home page", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const calls = await hosted(page);
  await H.boot(page);
  await page.getByRole("button", { name: "חשבון", exact: true }).click();
  let asked = "";
  page.once("dialog", (d) => { asked = d.message(); d.dismiss(); });
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  await expect.poll(() => asked).toContain("למחוק את החשבון");
  expect(calls.some((c) => c.path === "/rest/v1/rpc/delete_my_account")).toBe(false);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  await page.waitForURL(/:4173\/$/);
  expect(calls.some((c) => c.path === "/rest/v1/rpc/delete_my_account")).toBe(true);
  expect((await page.context().cookies()).find((c) => c.name === "ink_at")).toBeUndefined();
});

test("without a session the tool sends the person to sign in", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" });
  await hosted(page, { session: false });
  await page.goto("/index.html");
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

for (const [why, state] of [["blocked", { blocked: true }], ["pending", { approved: false }]])
  test(`an account that became ${why} is signed out at once, even from a page already open`, async ({ page }) => {
    test.info().annotations.push({ type: "no-self-check" });
    await hosted(page, { state });
    await page.goto("/index.html");
    await page.waitForURL("**/login.html#error=" + why);
    expect((await page.context().cookies()).find((c) => c.name === "ink_at")).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem("sb-cwsiranjlxbclmaqtucc-auth-token"))).toBe(null);
  });
