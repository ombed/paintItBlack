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
const MARK = String.fromCharCode(0x200b); // the invisible mark a repeated message ends in (login.js)
// a token with its own lifetime (iat, exp), as Supabase's are
const now = () => Math.floor(Date.now() / 1000);
const jwt = (life, tag) => [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "u1", role: "authenticated", iat: now(), exp: now() + life }), tag].join(".");

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
  // errors are read out through the field's description, one channel: no role=alert on a box hidden while empty
  await expect(page.locator("#password")).toHaveAttribute("aria-describedby", /email-err/);
  expect(await page.locator("#email-err").getAttribute("role")).toBeNull();
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
  // a second try with Enter: the same words with an invisible mark, so the description changes and is heard again
  await page.locator("#password").press("Enter");
  await expect(page.locator("#email-err")).toHaveText("המייל או הסיסמה לא נכונים." + MARK);
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
  // the site's cap is about no field: nothing is wrong with the address
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#sent-h")).toBeHidden();
});

// Resend's free plan stops at 100 a day; Supabase then answers 500 "Error sending ... email"
test("the sender's daily cap is said as a cap, on no field, not as a failed sign-in", async ({ page }) => {
  const down = (what) => ({ status: 500, body: { code: "unexpected_failure", message: "Error sending " + what + " email" } });
  await stub(page, { "/auth/v1/signup": down("confirmation"), "/auth/v1/recover": down("recovery") });
  await page.goto(LOGIN + "?mode=signup");
  await page.fill("#email", "new@example.co.il");
  await page.fill("#password", "long enough 1");
  await create(page).click();
  await expect(page.locator("#email-err")).toContainText("אי אפשר לשלוח מיילים כרגע");
  await expect(page.locator("#password")).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
  await page.getByRole("button", { name: "שליחת קישור" }).click();
  await expect(page.locator("#email-err")).toContainText("אי אפשר לשלוח מיילים כרגע");
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
  // the button disabled itself while sending; focus comes back to it, not to the page
  await expect(page.locator("#resend")).toBeFocused();
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
  await page.getByRole("button", { name: "שליחה חוזרת של מייל האימות" }).click();
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
  // the password typed here is the account's from now on (migration 0008 drops any earlier one), and the page says so
  await expect(page.locator("#newpw-label")).toHaveText("סיסמה לחשבון");
  await expect(page.locator("#confirm-why")).toContainText("איתה נכנסים מעכשיו");
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

test("the address verified but the password not saved: said exactly so, and saved on the next click without a new link", async ({ page }) => {
  let first = true;
  const calls = await stub(page, {
    "/auth/v1/verify": { body: SESSION },
    "/auth/v1/user": (route) => {
      if (route.request().method() !== "PUT") return route.fulfill({ contentType: "application/json", body: JSON.stringify(USER) });
      if (first) { first = false; return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "unexpected_failure", message: "Database error" }) }); }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(USER) });
    },
  });
  await page.goto(LOGIN + "#confirm=abc&type=signup");
  await page.fill("#newpw", "long enough 1");
  await page.getByRole("button", { name: "אימות וכניסה" }).click();
  await expect(page.locator("#confirm-err")).toContainText("הכתובת אומתה, אבל הסיסמה לא נשמרה");
  // nothing is wrong with the password itself; the button, which names the message, gets focus
  await expect(page.locator("#newpw")).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#confirm-go")).toBeFocused();
  await page.getByRole("button", { name: "אימות וכניסה" }).click();
  await page.waitForURL("**/site/app/");
  expect(calls.filter((c) => c.path === "/auth/v1/verify")).toHaveLength(1);
  expect(calls.filter((c) => c.path === "/auth/v1/user" && c.method === "PUT")).toHaveLength(2);
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
  // the message is read out with the button that gets focus
  await expect(page.locator("#confirm-go")).toBeFocused();
  await expect(page.locator("#confirm-go")).toHaveAttribute("aria-describedby", "confirm-err");
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

/* login.html?next=admin keeps "admin" for the tab until a sign-in uses it, through the round trip to
   Google. Any other opening of the sign-in page ends it: a sign-in that started on the admin page and
   was left sent a later, ordinary sign-in in the same tab to the admin page (the live check of 6.10). */
test("a sign-in from the admin page that was left does not send a later ordinary one there", async ({ page }) => {
  await stub(page, { "/auth/v1/token": { body: SESSION } });
  await page.route("**/site/admin.html", (route) => route.fulfill({ contentType: "text/html", body: "<title>admin</title>" }));
  await page.goto(LOGIN + "?next=admin");
  // left without signing in; later, in the same tab, the ordinary «כניסה»
  await page.goto("/site/index.html");
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await signIn(page).click();
  await page.waitForURL(/\/site\/(app\/|admin\.html)$/);
  expect(new URL(page.url()).pathname).toBe("/site/app/");
});

test("a sign-in from the admin page goes back there after the round trip to Google", async ({ page }) => {
  await stub(page, { "/auth/v1/user": { body: SESSION.user } });
  await page.route("**/site/admin.html", (route) => route.fulfill({ contentType: "text/html", body: "<title>admin</title>" }));
  await page.goto(LOGIN + "?next=admin");
  await page.click("#google");
  await page.waitForURL(PROJECT + "/auth/v1/authorize**");
  // Google's answer comes back to the page's own address, with the session after the #
  await page.goto(LOGIN + "#access_token=" + JWT + "&expires_in=3600&expires_at=" + SESSION.expires_at + "&refresh_token=r1&token_type=bearer");
  await page.waitForURL(/\/site\/(app\/|admin\.html)$/);
  expect(new URL(page.url()).pathname).toBe("/site/admin.html");
});

/* Google's round trip in one step: the authorize endpoint sends the person straight back where
   Supabase would, to the page's own address (redirect_to), with each answer in turn. A cancelled
   sign-in comes back as Supabase Auth writes it (external_oauth.go, external.go redirectErrors):
   the refusal in the query, its error_description empty, and after the # the error and "sb", the
   mark every redirect of Supabase's carries; an empty description is left out of the #. */
const CANCELLED = "?error=access_denied&error_description=#error=access_denied&sb=";
const SIGNED_IN = "#access_token=" + JWT + "&expires_at=" + SESSION.expires_at + "&expires_in=3600&refresh_token=r1&sb=&token_type=bearer";
const google = (...answers) => (route) => {
  const back = new URL(route.request().url()).searchParams.get("redirect_to");
  return route.fulfill({ status: 302, headers: { location: back + answers.shift() } });
};
const adminPage = (page) => page.route("**/site/admin.html", (route) => route.fulfill({ contentType: "text/html", body: "<title>admin</title>" }));
const signInHere = async (page) => {
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await signIn(page).click();
  await page.waitForURL(/\/site\/(app\/|admin\.html)$/);
  return new URL(page.url()).pathname;
};

/* A sign-in started on the admin page and cancelled at Google can be tried again, and still ends on
   the admin page: the cancel came back with an empty error_description, and the page took it for a
   fresh visit, so the retry opened the app (review of 6.10). Once it has ended there, the tab's next,
   ordinary sign-in opens the app. */
test("a sign-in from the admin page that Google cancelled is tried again and ends on the admin page; a later ordinary one opens the app", async ({ page }) => {
  await stub(page, { "/auth/v1/authorize": google(CANCELLED, SIGNED_IN), "/auth/v1/user": { body: SESSION.user }, "/auth/v1/token": { body: SESSION } });
  await adminPage(page);
  await page.goto(LOGIN + "?next=admin");
  await page.click("#google");
  await expect(page.locator("#email-err")).toHaveText("הכניסה בוטלה. אפשר לנסות שוב.");
  await page.click("#google");
  await page.waitForURL(/\/site\/(app\/|admin\.html)$/);
  expect(new URL(page.url()).pathname).toBe("/site/admin.html");
  // signed out there (this browser only), and later, in the same tab, the ordinary «כניסה»
  await page.evaluate((k) => localStorage.removeItem(k), STORE);
  await page.context().clearCookies();
  await page.goto("/site/index.html");
  await page.goto(LOGIN);
  expect(await signInHere(page)).toBe("/site/app/");
});

test("a sign-in from the admin page cancelled at Google and then left: a later ordinary one in the tab opens the app", async ({ page }) => {
  await stub(page, { "/auth/v1/authorize": google(CANCELLED), "/auth/v1/token": { body: SESSION } });
  await adminPage(page);
  await page.goto(LOGIN + "?next=admin");
  await page.click("#google");
  await expect(page.locator("#email-err")).toHaveText("הכניסה בוטלה. אפשר לנסות שוב.");
  await page.goto("/site/index.html");
  await page.goto(LOGIN);
  expect(await signInHere(page)).toBe("/site/app/");
});

/* Every way Supabase sends a sign-in back keeps the admin page as where it ends: a refusal with its
   reason, the cancel, and a Supabase from before the mark (no "sb"). The gate's reasons (#error=
   session and the like) are about the app: after a sign-in from the admin page was left, the sign-in
   the gate asks for opens the app. */
for (const [what, back] of [
  ["Google cancelled", CANCELLED],
  ["Google's state expired", "?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired#error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired&sb="],
  ["an older Supabase, without its mark", "?error=access_denied&error_description=#error=access_denied"],
])
  test(`a sign-in from the admin page that Supabase sent back refused (${what}) is tried again here and ends on the admin page`, async ({ page }) => {
    await stub(page, { "/auth/v1/token": { body: SESSION } });
    await adminPage(page);
    await page.goto(LOGIN + "?next=admin");
    await page.goto(LOGIN + back);
    await expect(page.locator("#email-err")).not.toBeEmpty();
    expect(await signInHere(page)).toBe("/site/admin.html");
  });

test("the gate's reason is about the app: after a sign-in from the admin page was left, the renewed session opens the app", async ({ page }) => {
  await stub(page, { "/auth/v1/token": { body: { ...SESSION, access_token: jwt(3600, "renewed"), refresh_token: "r2" } }, "/auth/v1/user": { body: SESSION.user } });
  await adminPage(page);
  await page.goto(LOGIN + "?next=admin");
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [STORE, SESSION]);
  await page.goto("about:blank");
  await page.goto(LOGIN + "#error=session");
  await page.waitForURL(/\/site\/(app\/|admin\.html)$/);
  expect(new URL(page.url()).pathname).toBe("/site/app/");
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

// (a network failure or a 5xx ends the same way, after supabase-js has retried for up to 30 s)
test("the gate says the session ended, and the renewal is refused for now (rate limit): the session is kept, nothing signed out", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/token": refusal(429, "over_request_rate_limit", "Request rate limit reached") });
  await signedIn(page);
  await page.goto(LOGIN + "#error=session");
  await expect(page.locator("#email-err")).toContainText("יותר מדי ניסיונות");
  expect(await page.evaluate((k) => localStorage.getItem(k), STORE)).not.toBeNull();
  expect(calls.filter((c) => c.path === "/auth/v1/logout")).toHaveLength(0);
  // a reason from the gate is about no field
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "false");
});

/* Two tool tabs restored together, both refused (review 4.10): both renew the same session, and
   supabase-js discards the slower renewal because the other tab already rewrote storage. That tab
   takes the other's session; it used to sign both out. */
test("two tabs renewing the same session: the one whose renewal is discarded takes the other's and goes in", async ({ page }) => {
  const OTHER = jwt(3600, "other-tab"), MINE = jwt(3600, "this-tab");
  const calls = await stub(page, {
    "/auth/v1/token": async (route) => {
      // the other tab finishes first and writes its renewal to the shared storage
      await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [STORE, { ...SESSION, access_token: OTHER, refresh_token: "r-other" }]);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...SESSION, access_token: MINE, refresh_token: "r-mine" }) });
    },
  });
  await signedIn(page);
  await page.goto(LOGIN + "#error=session");
  await page.waitForURL("**/site/app/");
  expect((await gateCookie(page)).value).toBe(OTHER);
  expect(calls.filter((c) => c.path === "/auth/v1/logout")).toHaveLength(0);
});

test("the gate says the account was deleted, and the server agrees: signed out here, said so, not sent back in", async ({ page }) => {
  await stub(page, { "/auth/v1/user": refusal(403, "user_not_found", "User from sub claim in JWT does not exist") });
  await signedIn(page);
  await page.goto(LOGIN + "#error=gone");
  await expect(page.locator("#email-err")).toContainText("נמחק");
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), STORE)).toBeNull();
  await page.waitForTimeout(1000);
  expect(new URL(page.url()).pathname).toBe(LOGIN);
});

// anyone can send a link ending in #error=gone (the landing page forwards it): the hash alone signs no one out
test("a link that only claims the account was deleted signs no one out", async ({ page }) => {
  const calls = await stub(page, { "/auth/v1/user": { body: SESSION.user } });
  await signedIn(page);
  await page.goto("/site/index.html#error=gone");
  await page.waitForURL(/\/site\/login\.html/);
  await expect(page.locator("#email-err")).not.toBeEmpty();
  await expect(page.locator("#email-err")).not.toContainText("נמחק");
  expect(await page.evaluate((k) => localStorage.getItem(k), STORE)).not.toBeNull();
  expect(calls.filter((c) => c.path === "/auth/v1/logout")).toHaveLength(0);
});

test("the session's end is kept on this computer's clock, whatever the server's clock says", async ({ page }) => {
  const T = jwt(3600, "fresh");
  // the server's expires_at is two hours off (its clock and this computer's disagree); the token itself lives an hour
  await stub(page, { "/auth/v1/token": { body: { ...SESSION, access_token: T, expires_at: now() + 3600 + 7200 } } });
  await page.goto(LOGIN);
  await page.fill("#email", "a@example.co.il");
  await page.fill("#password", "correct horse 42");
  await signIn(page).click();
  await page.waitForURL("**/site/app/");
  const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORE);
  expect(Math.abs(kept.expires_at - (now() + 3600))).toBeLessThan(30);
  const c = await gateCookie(page);
  expect(Math.abs(c.expires - (now() + 3600))).toBeLessThan(30);
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

// the address those two messages give is a link to write to it, in the same words (the live check of 6.10)
for (const [why, words] of [["blocked", "החשבון הזה חסום. לבירור אפשר לכתוב אל contact@inkognito.co.il."], ["pending", "החשבון ממתין לאישור. אפשר לכתוב אל contact@inkognito.co.il."]])
  test(`turned away by the gate (${why}): the contact address is a link to write to`, async ({ page }) => {
    await stub(page, { "/auth/v1/user": { body: SESSION.user } });
    await signedIn(page);
    await page.goto(LOGIN + "#error=" + why);
    await expect(page.locator("#email-err")).toHaveText(words);
    await expect(page.locator("#email-err").getByRole("link", { name: "contact@inkognito.co.il", exact: true })).toHaveAttribute("href", "mailto:contact@inkognito.co.il");
    // still read out through the field it is about, word for word
    await expect(page.locator("#email")).toHaveAccessibleDescription(words);
    await axe(page, why);
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
