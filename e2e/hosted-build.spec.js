const { test, expect } = require("./base");
const path = require("path");
const { build } = require("../scripts/build-hosted.js");

/* The hosted build itself (scripts/build-hosted.js, into dist/, served here at /dist/): the tool
   opens from /app/ with the hosted injection, and the real model loads from the build's own
   parts, re-split under Cloudflare's 25 MiB cap, joined by the page and passing its pinned
   SHA-256. Supabase is a stand-in: no account is touched. The gate itself runs on Cloudflare
   and is tested in tests/appgate_t.js. */

const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const SESSION = { access_token: [b64({ alg: "HS256" }), b64({ sub: "00000000-0000-0000-0000-00000000000a", exp: Math.floor(Date.now() / 1000) + 3600 }), "s"].join("."),
  token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
  user: { id: "00000000-0000-0000-0000-00000000000a", aud: "authenticated", role: "authenticated", email: "a@example.co.il" } };

test.beforeAll(() => { build(path.join(__dirname, "..", "dist")); });

test("the built tool opens under /app/ and its model loads from the re-split parts", async ({ page }) => {
  test.setTimeout(300000);
  await page.route(PROJECT + "/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/rest/v1/profiles") return route.fulfill({ json: [{ email: "a@example.co.il", full_name: null, log_enabled: true, approved: true, blocked: false }] });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript((s) => {
    try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); localStorage.setItem("sb-cwsiranjlxbclmaqtucc-auth-token", JSON.stringify(s)); } catch (_) {}
  }, SESSION);
  const asked = [], logs = [];
  page.on("request", (r) => asked.push(r.url()));
  page.on("console", (m) => logs.push(m.text()));
  await page.goto("/dist/app/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.getByRole("button", { name: "חשבון", exact: true })).toBeVisible();
  const r = await page.evaluate(async () => {
    const E = await import("./redact-engine.js");
    try { return { names: (await E.nerRun([{ text: "ביום שלישי נפגש דני כהן עם רונית לוי בחיפה." }])).map((n) => n.value) }; }
    catch (e) { return { error: String(e && e.message || e) }; }
  });
  expect(r.error).toBeUndefined();
  expect(r.names).toEqual(expect.arrayContaining(["דני כהן", "רונית לוי"]));
  expect(logs.some((l) => l.includes("קובץ המשקולות נבדק מול הגרסה הנעולה")), "the joined weights passed the pinned SHA-256").toBe(true);
  const parts = new Set(asked.filter((u) => /\/dist\/app\/models\/[^/]+\/onnx\/model_quantized\.onnx\.part\d+$/.test(u)));
  expect(parts.size).toBe(8);
  // the runtime's WebAssembly from the site itself, in its parts, and React and the fonts too
  expect(asked.filter((u) => /\/dist\/app\/vendor\/ort-[^/]+\/ort-wasm-simd-threaded\.asyncify\.wasm\.part\d$/.test(u)).length).toBeGreaterThanOrEqual(2);
  expect(asked.some((u) => /\/dist\/app\/vendor\/react-18\.3\.1\.production\.min\.js$/.test(u))).toBe(true);
  expect(asked.some((u) => /\/dist\/app\/fonts\/rubik-hebrew-400-normal\.woff2$/.test(u))).toBe(true);
  // and nothing from any other site: every request went to this site or the (stand-in) project
  const foreign = asked.filter((u) => !/^(https?:\/\/127\.0\.0\.1:4173\/|https:\/\/cwsiranjlxbclmaqtucc\.supabase\.co\/|data:|blob:)/.test(u));
  expect(foreign).toEqual([]);
});
