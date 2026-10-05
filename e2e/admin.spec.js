const { test, expect } = require("./base");
const AxeBuilder = require("@axe-core/playwright").default;

/* The owner's page (site/admin.html) against a stand-in for Supabase: no account is touched.
   What it pins: nothing shows without the owner's sign-in, or for an account that is not the
   owner; the owner sees every user, newest first, with the right totals; approving and blocking
   send exactly those two fields (the database allows no others); the owner cannot block
   themselves; a name a user typed is shown as text, never run; the logs download as one file
   with account ids only, no names or emails; past the 1,000 rows Supabase gives in one answer,
   nothing is left out; and the sign-in page brings the owner back here. */

const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const PAGE = "/site/admin.html";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const OWNER = "00000000-0000-0000-0000-0000000000ff";
const session = (id) => ({ access_token: [b64({ alg: "HS256" }), b64({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }), "s"].join("."),
  token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
  user: { id, aud: "authenticated", role: "authenticated", email: "owner@example.co.il" } });
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
const USERS = [
  { id: "00000000-0000-0000-0000-00000000000c", email: "c@example.co.il", full_name: "<img src=x onerror=\"window.__pwned=1\">", created_at: ago(1), last_seen: ago(1), approved: false, blocked: false, is_admin: false, log_enabled: null, documents: 0 },
  { id: "00000000-0000-0000-0000-00000000000b", email: "b@example.co.il", full_name: "Beta", created_at: ago(3), last_seen: ago(2), approved: true, blocked: true, is_admin: false, log_enabled: false, documents: 4 },
  { id: "00000000-0000-0000-0000-00000000000a", email: "a@example.co.il", full_name: null, created_at: ago(20), last_seen: ago(12), approved: true, blocked: false, is_admin: false, log_enabled: true, documents: 7 },
  { id: OWNER, email: "owner@example.co.il", full_name: "Owner", created_at: ago(30), last_seen: ago(0), approved: true, blocked: false, is_admin: true, log_enabled: true, documents: 2 },
];
const LOGS = [{ id: 1, user_id: USERS[2].id, created_at: ago(1), version: "v58", log: { tool: "paintItBlack", v: "v58", events: [{ t: 1, ev: "run" }] }, leaks: null }];

async function stub(page, { signedIn = true, admin = true, users = USERS, logs = LOGS, maxRows = 1000 } = {}) {
  const calls = [];
  await page.route(PROJECT + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    calls.push({ method: req.method(), path: u.pathname, query: u.search, body: req.postData() ? JSON.parse(req.postData()) : null });
    const wantsObject = /vnd\.pgrst\.object/.test(req.headers().accept || "");
    // as PostgREST pages: offset and limit, never more than the server's max rows, and the total
    // in Content-Range when the request asks for a count
    const rows = (all) => {
      const from = Number(u.searchParams.get("offset") || 0);
      const part = all.slice(from, from + Math.min(Number(u.searchParams.get("limit") || Infinity), maxRows));
      const range = (part.length ? from + "-" + (from + part.length - 1) : "*") + "/" + all.length;
      return route.fulfill({ json: part, headers: /count=exact/.test(req.headers().prefer || "") ? { "content-range": range, "access-control-expose-headers": "content-range" } : {} });
    };
    if (u.pathname === "/rest/v1/rpc/is_admin") return route.fulfill({ json: admin });
    if (u.pathname === "/rest/v1/profiles" && req.method() === "GET") return rows(users);
    if (u.pathname === "/rest/v1/app_settings" && req.method() === "GET") return route.fulfill({ json: wantsObject ? { require_approval: false } : [{ require_approval: false }] });
    if (u.pathname === "/rest/v1/usage_logs") return rows(logs);
    return route.fulfill({ status: 204, body: "" });
  });
  if (signedIn) await page.addInitScript((s) => { localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify(s)); }, session(OWNER));
  return calls;
}
const rowOf = (page, email) => page.locator("#rows tr", { has: page.getByText(email, { exact: true }) });

test("not signed in: only a way to sign in, which comes back here", async ({ page }) => {
  const calls = await stub(page, { signedIn: false });
  await page.goto(PAGE);
  await expect(page.locator("#signin")).toBeVisible();
  await expect(page.locator("#panel")).toBeHidden();
  await expect(page.getByRole("link", { name: "כניסה" })).toHaveAttribute("href", "login.html?next=admin");
  expect(calls.filter((c) => c.path.startsWith("/rest/"))).toEqual([]);
});

test("an account that is not the owner's sees nothing and asks for no data", async ({ page }) => {
  const calls = await stub(page, { admin: false });
  await page.goto(PAGE);
  await expect(page.locator("#denied")).toBeVisible();
  await expect(page.locator("#panel")).toBeHidden();
  expect(calls.some((c) => c.path === "/rest/v1/profiles" || c.path === "/rest/v1/usage_logs")).toBe(false);
});

test("the owner sees every user newest first, the totals, and a typed name only as text", async ({ page }) => {
  await stub(page);
  await page.goto(PAGE);
  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("#rows tr")).toHaveCount(4);
  await expect(page.locator("#rows tr").first()).toContainText("c@example.co.il");
  await expect(page.locator("#n-users")).toHaveText("4");
  await expect(page.locator("#n-new")).toHaveText("2");
  await expect(page.locator("#n-active")).toHaveText("3");
  await expect(page.locator("#n-docs")).toHaveText("13");
  await expect(page.locator("#n-wait")).toHaveText("1");
  await expect(rowOf(page, "c@example.co.il")).toContainText('<img src=x onerror="window.__pwned=1">');
  expect(await page.locator("#rows img").count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(rowOf(page, "b@example.co.il")).toContainText("חסום");
  await expect(rowOf(page, "b@example.co.il")).toContainText("כבוי");
  await expect(rowOf(page, "c@example.co.il")).toContainText("ממתין לאישור");
  await expect(rowOf(page, "c@example.co.il")).toContainText("עוד אין תשובה");
  await expect(rowOf(page, "owner@example.co.il").getByRole("button")).toHaveCount(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test("approve, block (after asking) and unblock send only those fields", async ({ page }) => {
  const calls = await stub(page);
  await page.goto(PAGE);
  const patches = () => calls.filter((c) => c.method === "PATCH" && c.path === "/rest/v1/profiles");
  await rowOf(page, "c@example.co.il").getByRole("button", { name: "אישור" }).click();
  await expect.poll(() => patches().length).toBe(1);
  expect(patches()[0]).toMatchObject({ query: "?id=eq." + USERS[0].id, body: { approved: true } });
  page.once("dialog", (d) => d.dismiss());
  await rowOf(page, "a@example.co.il").getByRole("button", { name: "חסימה" }).click();
  await page.waitForTimeout(300);
  expect(patches()).toHaveLength(1);
  page.once("dialog", (d) => d.accept());
  await rowOf(page, "a@example.co.il").getByRole("button", { name: "חסימה" }).click();
  await expect.poll(() => patches().length).toBe(2);
  expect(patches()[1]).toMatchObject({ query: "?id=eq." + USERS[2].id, body: { blocked: true } });
  await rowOf(page, "b@example.co.il").getByRole("button", { name: "ביטול חסימה" }).click();
  await expect.poll(() => patches().length).toBe(3);
  expect(patches()[2].body).toEqual({ blocked: false });
  for (const p of patches()) expect(Object.keys(p.body).every((k) => ["approved", "blocked"].includes(k))).toBe(true);
});

test("the require-approval switch changes the one setting", async ({ page }) => {
  const calls = await stub(page);
  await page.goto(PAGE);
  await page.getByLabel("לדרוש אישור למשתמשים חדשים").check();
  await expect.poll(() => calls.find((c) => c.method === "PATCH" && c.path === "/rest/v1/app_settings")).toMatchObject({ query: "?id=eq.true", body: { require_approval: true } });
  await expect(page.locator("#msg")).toContainText("ממתינים לאישור");
});

test("the logs download as one file the log report reads, with account ids and no names or emails", async ({ page }) => {
  await stub(page);
  await page.goto(PAGE);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /הורדת יומני השימוש/ }).click()]);
  const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  const out = JSON.parse(text);
  expect(out.export).toBe("inkognito-logs");
  expect(out.logs).toHaveLength(1);
  expect(out.logs[0]).toMatchObject({ user: USERS[2].id, v: "v58", log: { events: [{ ev: "run" }] } });
  expect(text).not.toMatch(/@|full_name|Beta|Owner/);
  const { reportExport } = require("../scripts/log-report.js");
  expect(reportExport(out)).toContain("1 log");
});

/* Supabase answers at most 1,000 rows a request, or fewer if its "max rows" is set lower, and says
   nothing when it stops there: the page read 1,000 users and 1,000 logs and showed them as all. */
for (const maxRows of [1000, 300]) test(`with ${maxRows} rows an answer, the owner still sees every user and downloads every log`, async ({ page }) => {
  const users = Array.from({ length: 2345 }, (_, i) => ({ ...USERS[2], id: "10000000-0000-0000-0000-" + String(i).padStart(12, "0"), email: "u" + i + "@example.co.il", created_at: ago(i / 1000), documents: 1 }));
  const logs = Array.from({ length: 1234 }, (_, i) => ({ ...LOGS[0], id: 1234 - i, created_at: ago(i / 1000) }));
  await stub(page, { users, logs, maxRows });
  await page.goto(PAGE);
  await expect(page.locator("#n-users")).toHaveText("2345");
  await expect(page.locator("#n-docs")).toHaveText("2345");
  await expect(page.locator("#rows tr")).toHaveCount(2345);
  await expect(page.locator("#rows tr").last()).toContainText("u2344@example.co.il");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /הורדת יומני השימוש/ }).click()]);
  const out = JSON.parse(await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8")));
  expect(out.count).toBe(1234);
  expect(new Set(out.logs.map((l) => l.at)).size).toBe(1234);
  expect(out.logs[1233].at).toBe(logs[1233].created_at);
  await expect(page.locator("#msg")).toHaveText("הורד קובץ עם 1234 יומנים.");
});

test("the sign-in page brings the owner back to this page, and to nothing else", async ({ page }) => {
  await stub(page);
  await page.route("**/site/app/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>app</title>" }));
  await page.goto("/site/login.html?next=admin");
  await page.waitForURL("**/site/admin.html");
  await page.goto("/site/login.html?next=https://evil.example");
  await page.waitForURL("**/site/app/");
});
