const { test, expect } = require("./base");
const AxeBuilder = require("@axe-core/playwright").default;

/* The sign-in page (site/login.html) against a stand-in for Supabase Auth: every request to the
   project is answered here, so no email is sent and no account is made. What it pins:
   - as on other sites (the owner's choice, 4.10): Google, or an email and a password; creating an
     account and "forgot password" are steps of their own; the page never asks for a sign-in link;
   - the links in the emails (confirm a new account, set a password) open this page with the token
     after # (never sent to a server), and nothing is spent until the person clicks: a mail
     scanner that fetches the link cannot use it;
   - Google goes to the project's authorize endpoint and comes back here;
   - Supabase's refusals are said in Hebrew, never in English.
   Supabase keeps the password hashed; the page only passes it on. */

const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const LOGIN = "/site/login.html";
// a token the client can read: header.payload.signature, payload with sub and exp
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "u1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"].join(".");
const SESSION = { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r1", user: { id: "u1", aud: "authenticated", role: "authenticated", email: "a@example.co.il" } };
const USER = { id: "u1", aud: "authenticated", role: "authenticated", email: "a@example.co.il", identities: [{ id: "i1", provider: "email" }] };

async function stub(page, answers = {}) {
  const calls = [];
  await page.route(PROJECT + "/**", async (route) => {
    const req = route.request(), url = new URL(req.url());
    calls.push({ method: req.method(), path: url.pathname, query: Object.fromEntries(url.searchParams), body: req.postDataJSON?.() ?? null });
    const a = answers[url.pathname];
    if (a) return route.fulfill({ status: a.status || 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
    if (url.pathname === "/auth/v1/authorize") return route.fulfill({ status: 200, contentType: "text/html", body: "<p>google</p>" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  // the app itself is not part of this page; arriving there is the success
  await page.route("**/site/app/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }));
  return calls;
}

async function axe(page, where) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${where}: ${v.id}`)).toEqual([]);
}

const gateCookie = async (page) => (await page.context().cookies()).find((c) => c.name === "ink_at");
const heading = (page) => page.getByRole("heading", { level: 1 });
const signIn = (page) => page.getByRole("button", { name: "כניסה", exact: true });
const create = (page) => page.getByRole("button", { name: "יצירת חשבון", exact: true });

test("signing in: Google, or an email and a password; the app opens with the gate's cookie", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/token": { body: SESSION } });
  await page.goto(LOGIN);
  await expect(heading(page)).toHaveText("כניסה");
  await expect(page.getByRole("button", { name: "כניסה עם Google" })).toBeVisible();
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
  await axe(page, "sign in");
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await signIn(page).click();
  await page.waitForURL("**/site/app/");
  const t = calls.find((c) => c.path === "/auth/v1/token");
  expect(t.query.grant_type).toBe("password");
  expect(t.body).toMatchObject({ email: "a@example.co.il", password: "correct horse 42" });
  expect((await gateCookie(page)).value).toBe(JWT);
  // no sign-in by an emailed link
  expect(calls.filter((c) => c.path === "/auth/v1/otp")).toHaveLength(0);
});

test("the password can be shown while typing it", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN);
  await page.fill("#password", "secret 1");
  await page.locator("#show").check();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.locator("#show").uncheck();
  await expect(page.locator("#password")).toHaveAttribute("type", "password");
});

test("a wrong password is said in Hebrew, on the password, and the page stays", async ({ page }) => {
  await stub(page, { "/auth/v1/token": { status: 400, body: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" } } });
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "wrong");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toHaveText("המייל או הסיסמה לא נכונים.");
  await expect(page.locator("#password")).toBeFocused();
  await expect(page.locator("#password")).toHaveAttribute("aria-invalid", "true");
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

test("too many tries, or an email asked for again too soon, are said in Hebrew", async ({ page }) => {
  await stub(page, {
    "/auth/v1/token": { status: 429, body: { code: 429, error_code: "over_request_rate_limit", msg: "Request rate limit reached" } },
    "/auth/v1/recover": { status: 429, body: { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 41 seconds." } },
  });
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "whatever 1");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toContainText("יותר מדי ניסיונות");
  await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
  await page.getByRole("button", { name: "שליחת קישור" }).click();
  await expect(page.locator("#email-err")).toContainText("דקה");
  await expect(page.locator("#email-err")).not.toContainText("security");
  await expect(page.locator("#sent-h")).toBeHidden();
});

test("creating an account: its own step, 8 characters, then an email confirms it", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/signup": { body: { ...USER, session: null } } });
  await page.goto(LOGIN);
  await create(page).click();
  await expect(heading(page)).toHaveText("יצירת חשבון");
  await expect(heading(page)).toBeFocused();
  await expect(page).toHaveTitle("יצירת חשבון · אינקוגניטו");
  await expect(page.getByRole("button", { name: "הרשמה עם Google" })).toBeVisible();
  await expect(page.locator("#pw-hint")).toBeVisible();
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByRole("button", { name: "שכחתי סיסמה" })).toBeHidden();
  await axe(page, "create account");
  await page.fill("#email", "new@example.co.il");
  await page.fill("#password", "short");
  await create(page).click();
  await expect(page.locator("#email-err")).toContainText("8");
  expect(calls.filter((c) => c.path === "/auth/v1/signup")).toHaveLength(0);
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#sent-h")).toHaveText("נשאר לאשר את המייל");
  await expect(page.locator(".sent .why")).toContainText("new@example.co.il");
  const s = calls.find((c) => c.path === "/auth/v1/signup");
  expect(s.body).toMatchObject({ email: "new@example.co.il", password: "long enough 1" });
  expect(s.query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
  await axe(page, "sent");
});

test("the landing page's sign-up buttons open on creating an account, and sign-in is one click away", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN + "?mode=signup");
  await expect(heading(page)).toHaveText("יצירת חשבון");
  await signIn(page).click();
  await expect(heading(page)).toHaveText("כניסה");
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
});

test("creating an account for an address that has one: told so, with the way to set a password", async ({ page }) => {
  await stub(page, { "/auth/v1/signup": { body: { ...USER, identities: [] } } });
  await page.goto(LOGIN + "?mode=signup");
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#email-err")).toContainText("שכחתי סיסמה");
  await expect(page.locator("#sent-h")).toBeHidden();
});

test("an account not confirmed yet: says so, and sends the confirmation again on request", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/token": { status: 400, body: { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" } } });
  await page.goto(LOGIN);
  await page.fill("#email", "new@example.co.il");
  await page.fill("#password", "long enough 1");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toContainText("לאשר את החשבון");
  await page.getByRole("button", { name: "שליחת מייל האישור שוב" }).click();
  await expect(page.locator("#sent-h")).toHaveText("נשאר לאשר את המייל");
  const r = calls.find((c) => c.path === "/auth/v1/resend");
  expect(r.body).toMatchObject({ type: "signup", email: "new@example.co.il" });
  expect(r.query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
});

test("forgot password: its own step; the link is sent without saying whether the address has an account", async ({ page }) => {
  const calls = await stub(page);
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
  await expect(heading(page)).toHaveText("שכחתי סיסמה");
  await expect(page.locator("#password")).toBeHidden();
  await expect(page.locator("#google")).toBeHidden();
  await expect(page.locator("#email")).toHaveValue("a@example.co.il");
  await axe(page, "forgot password");
  await page.getByRole("button", { name: "שליחת קישור" }).click();
  await expect(page.locator("#sent-h")).toHaveText("נשאר לפתוח את המייל");
  await expect(page.locator(".sent .why")).toContainText("אם יש חשבון");
  const r = calls.find((c) => c.path === "/auth/v1/recover");
  expect(r.body.email).toBe("a@example.co.il");
  expect(r.query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
  await page.getByRole("button", { name: "שינוי כתובת" }).click();
  await page.getByRole("button", { name: "חזרה לכניסה" }).click();
  await expect(page.locator("#password")).toBeVisible();
});

test("the link to set a password asks for it, spends the token once, and opens the app", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION }, "/auth/v1/user": { body: USER } });
  await page.goto(LOGIN + "#confirm=rec123&type=recovery");
  await expect(page.locator("#confirm-h")).toHaveText("איפוס סיסמה");
  await expect(page.locator("#newpw")).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await axe(page, "set password");
  await page.fill("#newpw", "short");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await expect(page.locator("#confirm-err")).toContainText("8");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(0);
  await page.fill("#newpw", "a new password 7");
  await page.locator("#newpw").press("Enter");
  await page.waitForURL("**/site/app/");
  const v = calls.filter((c) => c.path === "/auth/v1/verify");
  expect(v).toHaveLength(1);
  expect(v[0].body).toMatchObject({ token_hash: "rec123", type: "recovery" });
  const u = calls.find((c) => c.path === "/auth/v1/user" && c.method === "PUT");
  expect(u.body).toMatchObject({ password: "a new password 7" });
});

test("the link that confirms a new account waits for a click, then signs in with the gate's cookie", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION } });
  await page.goto(LOGIN + "#confirm=abc123hash&type=signup");
  await expect(page.locator("#confirm-h")).toHaveText("אישור החשבון");
  await expect(page.locator("#newpw")).toBeHidden();
  // the token is out of the address bar at once, and nothing was spent yet
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(0);
  await axe(page, "confirm account");
  await page.getByRole("button", { name: "אישור וכניסה" }).click();
  await page.waitForURL("**/site/app/");
  const v = calls.filter((c) => c.path === "/auth/v1/verify");
  expect(v).toHaveLength(1);
  expect(v[0].body).toMatchObject({ token_hash: "abc123hash", type: "email" });
  expect((await gateCookie(page)).value).toBe(JWT);
});

test("a sign-in link (the dashboard can still send one) still signs in", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION } });
  await page.goto(LOGIN + "#confirm=abc");
  await expect(page.locator("#confirm-h")).toHaveText("כניסה לאינקוגניטו");
  await page.click("#confirm-go");
  await page.waitForURL("**/site/app/");
  expect(calls.find((c) => c.path === "/auth/v1/verify").body).toMatchObject({ token_hash: "abc", type: "email" });
});

for (const [type, back, step] of [["signup", "חזרה לכניסה", "כניסה"], ["recovery", "שליחת קישור חדש", "שכחתי סיסמה"]])
  test(`an expired or used link (${type}) says so in Hebrew and leads to the next step`, async ({ page }) => {
    await stub(page, { "/auth/v1/verify": { status: 403, body: { code: 403, error_code: "otp_expired", msg: "Email link is invalid or has expired" } } });
    await page.goto(LOGIN + "#confirm=old&type=" + type);
    if (type === "recovery") await page.fill("#newpw", "a new password 7");
    await page.click("#confirm-go");
    await expect(page.locator("#confirm-err")).toContainText("פג");
    await expect(page.locator("#confirm-err")).not.toContainText("expired");
    await expect(page.locator("#newpw")).toBeHidden();
    await page.getByRole("button", { name: back }).click();
    await expect(heading(page)).toHaveText(step);
    await expect(page.locator("#email")).toBeFocused();
  });

test("an error Supabase puts in the address (Google refused, link expired) is shown in Hebrew", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator("#email-err")).toContainText("פג");
  await expect.poll(() => new URL(page.url()).hash).toBe("");
});

test("Google goes to the project's authorize endpoint and back to this page", async ({ page }) => {
  const calls = await stub(page);
  await page.goto(LOGIN);
  await page.click("#google");
  await page.waitForURL(PROJECT + "/auth/v1/authorize**");
  const a = calls.find((c) => c.path === "/auth/v1/authorize");
  expect(a.query.provider).toBe("google");
  expect(a.query.redirect_to).toBe(new URL(LOGIN, "http://127.0.0.1:4173").href);
});

test("someone already signed in goes straight to the app, with the gate's cookie", async ({ page }) => {
  await stub(page, { "/auth/v1/user": { body: SESSION.user } });
  await page.goto(LOGIN);
  await page.evaluate((s) => localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify(s)), SESSION);
  await page.goto(LOGIN);
  await page.waitForURL("**/site/app/");
  const c = await gateCookie(page);
  expect(c && c.value).toBe(JWT);
  expect(c.path).toBe("/");
  expect(c.sameSite).toBe("Lax");
  expect(c.expires * 1000).toBeGreaterThan(Date.now() + 3500 * 1000);
});

for (const [why, words] of [["blocked", "חסום"], ["pending", "ממתין לאישור"]])
  test(`turned away by the gate (${why}): says why, and does not bounce back into the app`, async ({ page }) => {
    await stub(page, { "/auth/v1/user": { body: SESSION.user } });
    await page.goto(LOGIN);
    await page.evaluate((s) => localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify(s)), SESSION);
    // the gate's redirect is a full page load from /app/; a hash-only change would not reload
    await page.goto("about:blank");
    await page.goto(LOGIN + "#error=" + why);
    await expect(page.locator("#email-err")).toContainText(words);
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe(LOGIN);
  });

test("signing up discloses the usage log, that it carries no text, and that it can be switched off", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN);
  const safe = page.locator(".safe");
  await expect(safe).toContainText("יומן שימוש");
  await expect(safe).toContainText("בלי טקסט מהמסמך");
  await expect(safe).toContainText("נשאל");
  await expect(safe).toContainText("לשנות את התשובה");
  await expect(safe.getByRole("link", { name: "מה נשלח" })).toHaveAttribute("href", "privacy.html");
});
