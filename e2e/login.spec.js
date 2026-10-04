const { test, expect } = require("./base");
const AxeBuilder = require("@axe-core/playwright").default;

/* The sign-in page (site/login.html) against a stand-in for Supabase Auth: every request to the
   project is answered here, so no email is sent and no account is made. What it pins:
   - the email link is asked for once per click, for this page, creating the account if new;
   - the link in the email opens this page with the token after # (never sent to a server), and
     nothing is spent until the person clicks: a mail scanner that fetches the link cannot use it;
   - Google goes to the project's authorize endpoint and comes back here;
   - Supabase's refusals (too soon, expired link) are said in Hebrew, never in English. */

const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const LOGIN = "/site/login.html";
// a token the client can read: header.payload.signature, payload with sub and exp
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "u1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"].join(".");
const SESSION = { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r1", user: { id: "u1", aud: "authenticated", role: "authenticated", email: "a@example.co.il" } };

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

test("the email link: one request for this page, then the sent state with a 60-second resend", async ({ page }) => {
  const calls = await stub(page);
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.click("button[type=submit]");
  await expect(page.locator("#sent-h")).toBeVisible();
  const otp = calls.filter((c) => c.path === "/auth/v1/otp");
  expect(otp).toHaveLength(1);
  expect(otp[0].body.email).toBe("a@example.co.il");
  expect(otp[0].body.create_user).toBe(true);
  expect(otp[0].query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
  await expect(page.locator("#resend")).toBeDisabled();
  await expect(page.locator("#t")).toHaveText(/^(60|59)$/);
  await expect(page.locator(".sent .why")).toContainText("15 דקות");
  await axe(page, "sent");
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

test("a refused request (too soon) is said in Hebrew and keeps the form", async ({ page }) => {
  await stub(page, { "/auth/v1/otp": { status: 429, body: { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 41 seconds." } } });
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.click("button[type=submit]");
  await expect(page.locator("#email-err")).toContainText("דקה");
  await expect(page.locator("#email-err")).not.toContainText("security");
  await expect(page.locator("#sent-h")).toBeHidden();
});

test("the link from the email waits for a click, then signs in and opens the app", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION } });
  await page.goto(LOGIN + "#confirm=abc123hash");
  await expect(page.locator("#confirm-h")).toBeVisible();
  // the token is out of the address bar at once, and nothing was spent yet
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(0);
  await axe(page, "confirm");
  await page.click("#confirm-go");
  await page.waitForURL("**/site/app/");
  const v = calls.filter((c) => c.path === "/auth/v1/verify");
  expect(v).toHaveLength(1);
  expect(v[0].body).toMatchObject({ token_hash: "abc123hash", type: "email" });
});

test("an expired or used link says so in Hebrew and offers a new one", async ({ page }) => {
  await stub(page, { "/auth/v1/verify": { status: 403, body: { code: 403, error_code: "otp_expired", msg: "Email link is invalid or has expired" } } });
  await page.goto(LOGIN + "#confirm=old");
  await page.click("#confirm-go");
  await expect(page.locator("#confirm-err")).toContainText("פג");
  await expect(page.locator("#confirm-err")).not.toContainText("expired");
  await page.click("#confirm-new");
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

const gateCookie = async (page) => (await page.context().cookies()).find((c) => c.name === "ink_at");

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

test("signing in from the email link also writes the gate's cookie", async ({ page }) => {
  await stub(page, { "/auth/v1/verify": { body: SESSION } });
  await page.goto(LOGIN + "#confirm=abc");
  await page.click("#confirm-go");
  await page.waitForURL("**/site/app/");
  expect((await gateCookie(page)).value).toBe(JWT);
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

/* Passwords (the owner's choice, 4.10): sign in with one, create an account with one (an email
   confirms it), and set one from an emailed link ("forgot password", or adding a password to an
   account made with Google or a link). Supabase keeps it hashed; the page only passes it on. */
const USER = { id: "u1", aud: "authenticated", role: "authenticated", email: "a@example.co.il", identities: [{ id: "i1", provider: "email" }] };

test("password: signing in sends the email and password, and opens the app with the gate's cookie", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/token": { body: SESSION } });
  await page.goto(LOGIN);
  await page.getByRole("button", { name: "כניסה עם סיסמה" }).click();
  await expect(page.locator("#password")).toBeFocused();
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await axe(page, "password mode");
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.waitForURL("**/site/app/");
  const t = calls.find((c) => c.path === "/auth/v1/token");
  expect(t.query.grant_type).toBe("password");
  expect(t.body).toMatchObject({ email: "a@example.co.il", password: "correct horse 42" });
  expect((await gateCookie(page)).value).toBe(JWT);
});

test("password: a wrong one is said in Hebrew, and the page stays", async ({ page }) => {
  await stub(page, { "/auth/v1/token": { status: 400, body: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" } } });
  await page.goto(LOGIN);
  await page.getByRole("button", { name: "כניסה עם סיסמה" }).click();
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "wrong");
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page.locator("#email-err")).toHaveText("המייל או הסיסמה לא נכונים.");
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

test("password: a new account needs 8 characters, then an email confirms it", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/signup": { body: { ...USER, session: null } } });
  await page.goto(LOGIN);
  await page.getByRole("button", { name: "כניסה עם סיסמה" }).click();
  await page.getByRole("button", { name: "יצירת חשבון עם סיסמה" }).click();
  await expect(page.locator("#pw-hint")).toBeVisible();
  await page.fill("#email", "new@example.co.il");
  await page.fill("#password", "short");
  await page.getByRole("button", { name: "יצירת חשבון", exact: true }).click();
  await expect(page.locator("#email-err")).toContainText("8");
  expect(calls.filter((c) => c.path === "/auth/v1/signup")).toHaveLength(0);
  await page.fill("#password", "long enough 1");
  await page.getByRole("button", { name: "יצירת חשבון", exact: true }).click();
  await expect(page.locator("#sent-h")).toHaveText("נשאר לאשר את המייל");
  await expect(page.locator(".sent .why")).toContainText("להיכנס עם הסיסמה");
  const s = calls.find((c) => c.path === "/auth/v1/signup");
  expect(s.body).toMatchObject({ email: "new@example.co.il", password: "long enough 1" });
  expect(s.query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
});

test("password: an address that already has an account is told so, with the way to set a password", async ({ page }) => {
  await stub(page, { "/auth/v1/signup": { body: { ...USER, identities: [] } } });
  await page.goto(LOGIN);
  await page.getByRole("button", { name: "כניסה עם סיסמה" }).click();
  await page.getByRole("button", { name: "יצירת חשבון עם סיסמה" }).click();
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "long enough 1");
  await page.getByRole("button", { name: "יצירת חשבון", exact: true }).click();
  await expect(page.locator("#email-err")).toContainText("שכחתי סיסמה");
  await expect(page.locator("#sent-h")).toBeHidden();
});

test("forgot password: a link is sent to set one", async ({ page }) => {
  const calls = await stub(page);
  await page.goto(LOGIN);
  await page.getByRole("button", { name: "כניסה עם סיסמה" }).click();
  await page.fill("#email", "a@example.co.il");
  await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
  await expect(page.locator("#sent-h")).toHaveText("קישור לקביעת סיסמה נשלח");
  const r = calls.find((c) => c.path === "/auth/v1/recover");
  expect(r.body.email).toBe("a@example.co.il");
  expect(r.query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
});

test("the link to set a password asks for it, spends the token once, and opens the app", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION }, "/auth/v1/user": { body: USER } });
  await page.goto(LOGIN + "#confirm=rec123&type=recovery");
  await expect(page.locator("#confirm-h")).toHaveText("קביעת סיסמה");
  await expect(page.locator("#newpw")).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await axe(page, "set password");
  await page.fill("#newpw", "short");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await expect(page.locator("#confirm-err")).toContainText("8");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(0);
  await page.fill("#newpw", "a new password 7");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/site/app/");
  const v = calls.filter((c) => c.path === "/auth/v1/verify");
  expect(v).toHaveLength(1);
  expect(v[0].body).toMatchObject({ token_hash: "rec123", type: "recovery" });
  const u = calls.find((c) => c.path === "/auth/v1/user" && c.method === "PUT");
  expect(u.body).toMatchObject({ password: "a new password 7" });
});
