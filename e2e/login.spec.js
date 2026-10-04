const { test, expect } = require("./base");
const AxeBuilder = require("@axe-core/playwright").default;

/* The sign-in page (site/login.html) against a stand-in for Supabase Auth: every request to the
   project is answered here, so no email is sent and no account is made. What it pins:
   - as on other sites (the owner's choice, 4.10): Google, or an email and a password; creating an
     account and "forgot password" are steps of their own; the page never asks for a sign-in link;
   - the links in the emails (verify a new account, reset a password) open this page with the token
     after # (never sent to a server), and nothing is spent until the person clicks: a mail
     scanner that fetches the link cannot use it. Both ask for the password, and save it;
   - Google goes to the project's authorize endpoint and comes back here;
   - sent back by the gate, the page never sends the same session straight back in (review 4.10);
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
const STORE = "sb-cwsiranjlxbclmaqtucc-auth-token";

async function stub(page, answers = {}) {
  const calls = [];
  await page.route(PROJECT + "/**", async (route) => {
    const req = route.request(), url = new URL(req.url());
    calls.push({ method: req.method(), path: url.pathname, query: Object.fromEntries(url.searchParams), body: req.postDataJSON?.() ?? null });
    const a = answers[url.pathname];
    if (typeof a === "function") return a(route, calls);
    if (a) return route.fulfill({ status: a.status || 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
    if (url.pathname === "/auth/v1/authorize") return route.fulfill({ status: 200, contentType: "text/html", body: "<p>google</p>" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  // the app itself is not part of this page; arriving there is the success
  await page.route("**/site/app/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }));
  return calls;
}
const refusal = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });

async function axe(page, where) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${where}: ${v.id}`)).toEqual([]);
}

const gateCookie = async (page) => (await page.context().cookies()).find((c) => c.name === "ink_at");
const heading = (page) => page.getByRole("heading", { level: 1 });
const signIn = (page) => page.getByRole("button", { name: "כניסה", exact: true });
const create = (page) => page.getByRole("button", { name: "יצירת חשבון", exact: true });
// a session already kept in this browser, as after an earlier sign-in
async function signedIn(page) {
  await page.goto(LOGIN);
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [STORE, SESSION]);
  // the gate's redirect is a full page load from /app/; a hash-only change would not reload
  await page.goto("about:blank");
}

test("signing in: Google, or an email and a password; the app opens with the gate's cookie", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/token": { body: SESSION } });
  await page.goto(LOGIN);
  await expect(heading(page)).toHaveText("כניסה");
  await expect(page.getByRole("button", { name: "כניסה עם Google" })).toBeVisible();
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.locator("#email-err")).toHaveAttribute("role", "alert");
  await axe(page, "sign in");
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await signIn(page).click();
  await page.waitForURL("**/site/app/");
  const t = calls.find((c) => c.path === "/auth/v1/token");
  expect(t.query.grant_type).toBe("password");
  expect(t.body).toMatchObject({ email: "a@example.co.il", password: "correct horse 42" });
  const c = await gateCookie(page);
  expect(c.value).toBe(JWT);
  // the cookie's life comes from the token, not this computer's clock
  expect(c.expires * 1000).toBeGreaterThan(Date.now() + 3500 * 1000);
  // no sign-in by an emailed link
  expect(calls.filter((c) => c.path === "/auth/v1/otp")).toHaveLength(0);
});

test("the password can be shown while typing it, with no spell check or capitals", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN);
  for (const f of ["#password", "#newpw"]) {
    await expect(page.locator(f)).toHaveAttribute("spellcheck", "false");
    await expect(page.locator(f)).toHaveAttribute("autocapitalize", "off");
  }
  await page.fill("#password", "secret 1");
  await page.locator("#show").check();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.locator("#show").uncheck();
  await expect(page.locator("#password")).toHaveAttribute("type", "password");
});

test("a wrong password is said in Hebrew, on the password, and the page stays", async ({ page }) => {
  await stub(page, { "/auth/v1/token": refusal(400, "invalid_credentials", "Invalid login credentials") });
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "wrong");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toHaveText("המייל או הסיסמה לא נכונים.");
  await expect(page.locator("#password")).toBeFocused();
  await expect(page.locator("#password")).toHaveAttribute("aria-invalid", "true");
  // a second try with Enter says it again (the alert is emptied and filled anew)
  await page.locator("#password").press("Enter");
  await expect(page.locator("#email-err")).toHaveText("המייל או הסיסמה לא נכונים.");
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

test("too many tries, an email asked for again too soon, and the site's hourly cap are each said as they are", async ({ page }) => {
  let hourly = false;
  await stub(page, {
    "/auth/v1/token": refusal(429, "over_request_rate_limit", "Request rate limit reached"),
    "/auth/v1/recover": (route) => route.fulfill({ status: 429, contentType: "application/json",
      body: JSON.stringify({ code: 429, error_code: "over_email_send_rate_limit", msg: hourly ? "email rate limit exceeded" : "For security purposes, you can only request this after 41 seconds." }) }),
  });
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "whatever 1");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toContainText("יותר מדי ניסיונות");
  await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
  await page.getByRole("button", { name: "שליחת קישור" }).click();
  await expect(page.locator("#email-err")).toContainText("בעוד 41 שניות");
  await expect(page.locator("#email-err")).not.toContainText("security");
  hourly = true;
  await page.getByRole("button", { name: "שליחת קישור" }).click();
  await expect(page.locator("#email-err")).toContainText("מאוחר יותר");
  await expect(page.locator("#email-err")).not.toContainText("לפני רגע");
  await expect(page.locator("#sent-h")).toBeHidden();
});

test("creating an account: its own step, 8 characters, then an email verifies the address", async ({ page }) => {
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
  // Supabase refuses over 72 bytes, and a Hebrew letter is two
  await page.fill("#password", "א".repeat(37));
  await create(page).click();
  await expect(page.locator("#email-err")).toContainText("ארוכה מדי");
  expect(calls.filter((c) => c.path === "/auth/v1/signup")).toHaveLength(0);
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#sent-h")).toHaveText("נשאר לאמת את המייל");
  await expect(page.locator(".sent .why")).toContainText("new@example.co.il");
  const s = calls.find((c) => c.path === "/auth/v1/signup");
  expect(s.body).toMatchObject({ email: "new@example.co.il", password: "long enough 1" });
  expect(s.query.redirect_to).toBe(new URL(LOGIN, page.url()).href);
  await axe(page, "sent");
});

test("a refused resend is shown on the page, not only to screen readers", async ({ page }) => {
  await page.clock.install();
  await stub(page, { "/auth/v1/signup": { body: { ...USER, session: null } }, "/auth/v1/resend": refusal(429, "over_email_send_rate_limit", "email rate limit exceeded") });
  await page.goto(LOGIN + "?mode=signup");
  await page.fill("#email", "new@example.co.il");
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#sent-h")).toBeVisible();
  await page.clock.runFor(61000);
  await page.getByRole("button", { name: "שליחה חוזרת" }).click();
  await expect(page.locator("#sent-err")).toBeVisible();
  await expect(page.locator("#sent-err")).toContainText("מאוחר יותר");
});

test("the landing page's sign-up buttons open on creating an account, and sign-in is one click away", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN + "?mode=signup");
  await expect(heading(page)).toHaveText("יצירת חשבון");
  await signIn(page).click();
  await expect(heading(page)).toHaveText("כניסה");
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
});

test("creating an account for an address that has one: told so on the address, with the way to set a password", async ({ page }) => {
  await stub(page, { "/auth/v1/signup": { body: { ...USER, identities: [] } } });
  await page.goto(LOGIN + "?mode=signup");
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#email-err")).toContainText("שכחתי סיסמה");
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#sent-h")).toBeHidden();
});

test("an address Supabase refuses at sign-up is marked on the address, not the password", async ({ page }) => {
  await stub(page, { "/auth/v1/signup": refusal(400, "email_address_invalid", "Email address is invalid") });
  await page.goto(LOGIN + "?mode=signup");
  await page.fill("#email", "name@gmial.con");
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#email-err")).toContainText("הכתובת לא נראית תקינה");
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#password")).toHaveAttribute("aria-invalid", "false");
});

test("an account not verified yet: says so, and sends the email again on request", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/token": refusal(400, "email_not_confirmed", "Email not confirmed") });
  await page.goto(LOGIN);
  await page.fill("#email", "new@example.co.il");
  await page.fill("#password", "long enough 1");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toContainText("לאמת את כתובת המייל");
  await page.getByRole("button", { name: "שליחת מייל האימות שוב" }).click();
  await expect(page.locator("#sent-h")).toHaveText("נשאר לאמת את המייל");
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

test("the link to reset a password asks for it, spends the token once, and opens the app", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION }, "/auth/v1/user": { body: USER } });
  await page.goto(LOGIN + "#confirm=rec123&type=recovery");
  await expect(page.locator("#confirm-h")).toHaveText("איפוס סיסמה");
  await expect(page.locator("#newpw")).toBeVisible();
  await expect(page.locator("#newpw-label")).toHaveText("סיסמה חדשה");
  await expect(page.locator("#newpw")).toHaveAttribute("autocomplete", "new-password");
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await axe(page, "reset password");
  await page.fill("#newpw", "short");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await expect(page.locator("#confirm-err")).toContainText("8");
  await expect(page.locator("#newpw")).toHaveAttribute("aria-invalid", "true");
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

test("the reset link with the password the account already has just goes in", async ({ page }) => {
  await stub(page, { "/auth/v1/verify": { body: SESSION }, "/auth/v1/user": refusal(422, "same_password", "New password should be different from the old password.") });
  await page.goto(LOGIN + "#confirm=rec1&type=recovery");
  await page.fill("#newpw", "my old password 1");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/site/app/");
});

/* Pre-account takeover (review 4.10): Supabase keeps the password of whoever signed up with an
   address first, also when the one who opens the email signed up later. So the link that verifies
   the address takes the password and saves it: whoever holds the inbox decides it. */
test("the link that verifies a new account asks for the password, saves it, and signs in with the gate's cookie", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION }, "/auth/v1/user": { body: USER } });
  await page.goto(LOGIN + "#confirm=abc123hash&type=signup");
  await expect(page.locator("#confirm-h")).toHaveText("אימות כתובת המייל");
  await expect(page.locator("#newpw")).toBeVisible();
  await expect(page.locator("#newpw-label")).toHaveText("סיסמה");
  await expect(page.locator("#newpw")).toHaveAttribute("autocomplete", "current-password");
  // the token is out of the address bar at once, and nothing was spent yet
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(0);
  await axe(page, "verify account");
  await page.fill("#newpw", "long enough 1");
  await page.getByRole("button", { name: "אימות וכניסה" }).click();
  await page.waitForURL("**/site/app/");
  const v = calls.filter((c) => c.path === "/auth/v1/verify");
  expect(v).toHaveLength(1);
  expect(v[0].body).toMatchObject({ token_hash: "abc123hash", type: "email" });
  const u = calls.find((c) => c.path === "/auth/v1/user" && c.method === "PUT");
  expect(u.body).toMatchObject({ password: "long enough 1" });
  expect((await gateCookie(page)).value).toBe(JWT);
});

test("verifying with the same password as at sign-up (the usual case) goes in", async ({ page }) => {
  await stub(page, { "/auth/v1/verify": { body: SESSION }, "/auth/v1/user": refusal(422, "same_password", "New password should be different from the old password.") });
  await page.goto(LOGIN + "#confirm=abc&type=signup");
  await page.fill("#newpw", "long enough 1");
  await page.getByRole("button", { name: "אימות וכניסה" }).click();
  await page.waitForURL("**/site/app/");
});

test("a click the network lost does not spend the link: the same button works again", async ({ page }) => {
  let first = true;
  const calls = await stub(page, {
    "/auth/v1/verify": (route) => { if (first) { first = false; return route.abort(); } return route.fulfill({ contentType: "application/json", body: JSON.stringify(SESSION) }); },
    "/auth/v1/user": { body: USER },
  });
  await page.goto(LOGIN + "#confirm=abc&type=signup");
  await page.fill("#newpw", "long enough 1");
  await page.getByRole("button", { name: "אימות וכניסה" }).click();
  await expect(page.locator("#confirm-err")).not.toBeEmpty();
  await expect(page.getByRole("button", { name: "אימות וכניסה" })).toBeEnabled();
  await page.getByRole("button", { name: "אימות וכניסה" }).click();
  await page.waitForURL("**/site/app/");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(2);
});

test("a sign-in link (the dashboard can still send one) still signs in, with nothing to type", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/verify": { body: SESSION } });
  await page.goto(LOGIN + "#confirm=abc");
  await expect(page.locator("#confirm-h")).toHaveText("כניסה לאינקוגניטו");
  await expect(page.locator("#newpw")).toBeHidden();
  await page.click("#confirm-go");
  await page.waitForURL("**/site/app/");
  expect(calls.find((c) => c.path === "/auth/v1/verify").body).toMatchObject({ token_hash: "abc", type: "email" });
});

test("a link that reached the landing page (Supabase's fallback address) goes on to this page", async ({ page }) => {
  await stub(page);
  await page.goto("/site/index.html#confirm=abc&type=signup");
  await page.waitForURL(/\/site\/login\.html/);
  await expect(page.locator("#confirm-h")).toHaveText("אימות כתובת המייל");
});

for (const [type, back, step] of [["signup", "חזרה לכניסה", "כניסה"], ["recovery", "שליחת קישור חדש", "שכחתי סיסמה"]])
  test(`an expired or used link (${type}) says so in Hebrew and leads to the next step`, async ({ page }) => {
    await stub(page, { "/auth/v1/verify": refusal(403, "otp_expired", "Email link is invalid or has expired") });
    await page.goto(LOGIN + "#confirm=old&type=" + type);
    await page.fill("#newpw", "a new password 7");
    await page.click("#confirm-go");
    await expect(page.locator("#confirm-err")).toContainText("פג");
    await expect(page.locator("#confirm-err")).not.toContainText("expired");
    await expect(page.locator("#newpw")).toBeHidden();
    // focus is not lost with the button that went away
    await expect(page.getByRole("button", { name: back })).toBeFocused();
    await page.getByRole("button", { name: back }).click();
    await expect(heading(page)).toHaveText(step);
    await expect(page.locator("#email")).toBeFocused();
  });

test("an error Supabase puts in the address (a link it rejected) is shown in Hebrew", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator("#email-err")).toContainText("פג");
  await expect.poll(() => new URL(page.url()).hash).toBe("");
});

test("a Google sign-in that timed out is not called an expired link", async ({ page }) => {
  await stub(page);
  await page.goto(LOGIN + "#error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired");
  await expect(page.locator("#email-err")).toContainText("Google");
  await expect(page.locator("#email-err")).not.toContainText("קישור");
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
  await signedIn(page);
  await page.goto(LOGIN);
  await page.waitForURL("**/site/app/");
  const c = await gateCookie(page);
  expect(c && c.value).toBe(JWT);
  expect(c.path).toBe("/");
  expect(c.sameSite).toBe("Lax");
  expect(c.expires * 1000).toBeGreaterThan(Date.now() + 3500 * 1000);
});

test("a browser that refuses the cookie is told so, instead of being sent to a gate that would send it back", async ({ page }) => {
  await stub(page, { "/auth/v1/token": { body: SESSION } });
  await page.addInitScript(() => Object.defineProperty(Document.prototype, "cookie", { get: () => "", set: () => {}, configurable: true }));
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await signIn(page).click();
  await expect(page.locator("#email-err")).toContainText("עוגיות");
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

// the gate's reasons (lib/gate.mjs): sent back, the page never sends the same session straight in
test("the gate says the session ended: renewed once on the server and back in; refused again, signed out here", async ({ page }) => {
  const NEW = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "u1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }), "renewed"].join(".");
  const calls = await stub(page, { "/auth/v1/token": { body: { ...SESSION, access_token: NEW, refresh_token: "r2" } }, "/auth/v1/user": { body: SESSION.user } });
  await signedIn(page);
  await page.goto(LOGIN + "#error=session");
  await page.waitForURL("**/site/app/");
  expect(calls.filter((c) => c.path === "/auth/v1/token" && c.query.grant_type === "refresh_token")).toHaveLength(1);
  expect((await gateCookie(page)).value).toBe(NEW);
  // the gate refuses the renewed session too, moments later: no second round, signed out here
  await page.goto(LOGIN + "#error=session");
  await expect(page.locator("#email-err")).toContainText("צריך להיכנס שוב");
  expect(calls.filter((c) => c.path === "/auth/v1/token" && c.query.grant_type === "refresh_token")).toHaveLength(1);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), STORE)).toBeNull();
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

test("the gate says the account was deleted: signed out here, said so, and not sent back in", async ({ page }) => {
  await stub(page, { "/auth/v1/user": { body: SESSION.user } });
  await signedIn(page);
  await page.goto(LOGIN + "#error=gone");
  await expect(page.locator("#email-err")).toContainText("נמחק");
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), STORE)).toBeNull();
  await page.waitForTimeout(1000);
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

for (const [why, words] of [["blocked", "חסום"], ["pending", "ממתין לאישור"]])
  test(`turned away by the gate (${why}): says why, and does not bounce back into the app`, async ({ page }) => {
    await stub(page, { "/auth/v1/user": { body: SESSION.user } });
    await signedIn(page);
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
  // and what Google hands over, all of it
  await expect(safe).toContainText("תמונת הפרופיל");
});
