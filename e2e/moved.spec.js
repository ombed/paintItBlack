const { test, expect } = require("./base");
const H = require("./helpers");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AxeBuilder = require("@axe-core/playwright").default;

/* The old address, https://ombed.github.io/inkognito/, after the move to inkognito.co.il (the owner's
   decision, 6.10.2026). GitHub Pages serves the forward there (scripts/build-forward.js): a page that
   sends a visitor with nothing saved straight to inkognito.co.il, and offers a visitor with saved cases
   a file of all of them, to import after signing up («ייבוא תיקים מקובץ»); and a service worker that
   replaces the tool's. Her saved cases live in this browser's localStorage at that address, so nothing
   here may lose them, and nothing may leave the browser.

   Each test runs its own server on a free port, like GitHub Pages: a missing path is answered by
   404.html. The handover changes what that server serves between two visits. In the deploy
   (.github/workflows/pages.yml) FORWARD_ROOT is the folder about to be published; here it is built
   from the repository. No request reaches inkognito.co.il or any other site: inkognito.co.il is a stub.
   Every name here is invented. */

const ROOT = path.join(__dirname, "..");
const TEXT = [
  "הכלי עבר לכתובת חדשה: inkognito.co.il. בכתובת החדשה עובדים עם חשבון (חינם).",
  "התיקים ששמרתם בדפדפן הזה לא עוברים לבד. כדי להעביר אותם, מורידים אותם כאן לקובץ, ואחרי ההרשמה בוחרים «ייבוא תיקים מקובץ».",
  "הקובץ מכיל את שמות הלקוחות שבתיקים: שמרו אותו כמו כל מסמך של תיק.",
];
const DOWNLOAD = "הורדת התיקים לקובץ", GO = "מעבר לאינקוגניטו", SIGNUP = "https://inkognito.co.il/login?mode=signup", HOME = "https://inkognito.co.il/";
const LAST_CARD = "להמשיך עם רשימת השמות מהפעם הקודמת?";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

const profile = (name, real, fake, updated = "2026-09-01T09:00:00.000Z") => ({ v: 1, name, created: "2026-08-20T09:00:00.000Z", updated, mode: "real",
  rules: [{ value: real, kind: "NAME", replacement: fake, auto: false, g: null }], allow: [], map: { [real]: fake }, removed: [], sent: {},
  styles: { num: "blank", date: "name" } });
const CASES = {
  "לוי נ׳ לוי": profile("לוי נ׳ לוי", "שרה לוי", "דנה רום", "2026-09-04T09:00:00.000Z"),
  "כהן נ׳ כהן": profile("כהן נ׳ כהן", "אורית כהן", "מירב טל", "2026-09-03T09:00:00.000Z"),
  "אבן נ׳ אבן": profile("אבן נ׳ אבן", "עוז אבן", "טל דור", "2026-09-02T09:00:00.000Z"),
};
const LAST = profile("", "תמר רז", "ליאת בר");

// folders made here are removed after the file's tests: a downloaded cases file holds names, invented or not
const temps = [];
const tempDir = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temps.push(d); return d; };
test.afterAll(() => { for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

// the forward site: the folder the deploy is about to publish, or one built from the repository
let built = null;
function forwardSite() {
  if (process.env.FORWARD_ROOT) return path.resolve(process.env.FORWARD_ROOT);
  if (!built) built = require("../scripts/build-forward.js").build(path.join(tempDir("forward-"), "site"));
  return built;
}

// a static server on a free port that answers a missing path with 404.html, as GitHub Pages does;
// state.root may change between visits
function serve(root) {
  const state = { root };
  const server = http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(req.url.split("?")[0]); } catch (_) { res.writeHead(400).end(); return; }
    const base = path.resolve(state.root), file = path.join(base, url === "/" ? "/index.html" : url);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (!err) { res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(buf); return; }
      fs.readFile(path.join(base, "404.html"), (err404, page) => {
        if (err404) res.writeHead(404).end("not found");
        else res.writeHead(404, { "content-type": TYPES[".html"] }).end(page);
      });
    });
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ state, server, base: "http://127.0.0.1:" + server.address().port })));
}

// inkognito.co.il is a stub page; any other request off this computer is refused and recorded.
// allow: hosts the tool itself loads its pinned libraries from (the moved page loads nothing)
async function guard(page, allow = []) {
  const outside = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "inkognito.co.il") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!DOCTYPE html><title>stub</title><p>inkognito.co.il stub</p>" });
    if (allow.includes(u.hostname)) return route.continue();
    outside.push(u.href);
    return route.abort();
  });
  return outside;
}
const seedOld = (page, items) => page.addInitScript((items) => {
  for (const [k, v] of Object.entries(items)) localStorage.setItem(k, JSON.stringify(v));
}, items);
const shown = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
// an evaluate during a navigation the page did not start throws; poll through it
const settled = (page, fn) => page.evaluate(fn).catch(() => "navigating");

test("the moved page offers her saved cases as one file, in the approved words, and nothing leaves the browser", async ({ page }) => {
  const site = await serve(forwardSite());
  try {
    const outside = await guard(page);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await seedOld(page, { "redact-cases": CASES, "redact-profile-last": LAST });
    await page.goto(site.base + "/index.html");
    await expect(page).toHaveTitle("אינקוגניטו: הכלי עבר לכתובת חדשה");
    await expect(page.locator("main p")).toHaveText(TEXT);
    const download = page.getByRole("button", { name: DOWNLOAD, exact: true });
    await expect(download).toBeVisible();
    await expect(page.getByRole("link", { name: GO, exact: true })).toHaveAttribute("href", SIGNUP);
    // these words and no others: the wordmark, the three paragraphs, the two buttons
    expect(await shown(page)).toBe(["אינקוגניטו", ...TEXT, DOWNLOAD, GO].join(" "));

    // the keyboard: the download first, then the link, each with a visible ring
    const ring = (loc) => loc.evaluate((el) => { const s = getComputedStyle(el); return [s.outlineStyle, parseFloat(s.outlineWidth) >= 2]; });
    await page.keyboard.press("Tab");
    await expect(download).toBeFocused();
    expect(await ring(download)).toEqual(["solid", true]);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: GO })).toBeFocused();
    expect(await ring(page.getByRole("link", { name: GO }))).toEqual(["solid", true]);

    // the file: exactly what this browser stored, in the format «ייבוא תיקים מקובץ» reads, in UTF-8
    const [dl] = await Promise.all([page.waitForEvent("download"), download.click()]);
    const body = fs.readFileSync(await dl.path(), "utf8");
    const file = JSON.parse(body);
    expect(Object.keys(file)).toEqual(["inkognito", "v", "exported", "cases", "last"]);
    expect([file.inkognito, file.v]).toEqual(["cases", 1]);
    const stored = await page.evaluate(() => [localStorage.getItem("redact-cases"), localStorage.getItem("redact-profile-last")].map((s) => JSON.parse(s)));
    expect(file.cases).toEqual(stored[0]);
    expect(file.last).toEqual(stored[1]);
    expect(file.cases).toEqual(CASES);
    expect(Math.abs(Date.parse(file.exported) - Date.now())).toBeLessThan(120000);
    expect(dl.suggestedFilename()).toBe("inkognito-cases-" + file.exported.slice(0, 10) + ".json");

    // the look: WCAG AA by day and by night, no sideways scroll at 320px
    const axe = async (where) => {
      const r = await new AxeBuilder({ page }).options({ preload: false }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(r.violations.map((v) => `${where}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")})`)).toEqual([]);
    };
    await axe("day");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await axe("night");
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 700 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), "no sideways scroll at " + width).toBeLessThanOrEqual(width);
    }
    // the night the tool was set to wins over the system's day, as in the tool
    await page.emulateMedia({ colorScheme: "light" });
    await page.evaluate(() => localStorage.setItem("redact-theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    expect(outside, "nothing left the browser").toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    site.server.close();
  }
});

test("with nothing saved the moved page sends the visitor straight to inkognito.co.il, from an old deep link too", async ({ page }) => {
  const site = await serve(forwardSite());
  try {
    const outside = await guard(page);
    await page.goto(site.base + "/index.html");
    await page.waitForURL(HOME);
    await expect(page.locator("body")).toHaveText("inkognito.co.il stub");
    // an old link into the tool lands on 404.html, the same page
    await page.goto(site.base + "/old/deep/link.html?x=1#y");
    await page.waitForURL(HOME);
    // a case list emptied in the tool, and no last profile, is nothing saved
    await page.goto(site.base + "/sw.js");
    await page.evaluate(() => localStorage.setItem("redact-cases", "{}"));
    await page.goto(site.base + "/");
    await page.waitForURL(HOME);
    // a last profile alone is something to take along
    await page.goto(site.base + "/sw.js");
    await page.evaluate((l) => localStorage.setItem("redact-profile-last", JSON.stringify(l)), LAST);
    await page.goto(site.base + "/");
    await expect(page.locator("main p")).toHaveText(TEXT);
    expect(page.url()).toBe(site.base + "/");
    expect(outside, "nothing left the browser but the stub").toEqual([]);
  } finally {
    site.server.close();
  }
});

test("the handover: the tool's worker gives way, its caches and the model go, the saved cases stay, and the page ends on the moved page", async ({ page }) => {
  const site = await serve(ROOT);
  try {
    await guard(page, ["unpkg.com", "cdn.jsdelivr.net"]);
    await page.addInitScript(() => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} });
    // until now: the tool at this address, its worker installed and in control
    await page.goto(site.base + "/index.html");
    await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    await page.evaluate(async ([c, l]) => {
      localStorage.setItem("redact-cases", JSON.stringify(c));
      localStorage.setItem("redact-profile-last", JSON.stringify(l));
      // the model, where transformers.js keeps it
      const m = await caches.open("transformers-cache");
      await m.put("https://huggingface.co/x/resolve/r/config.json", new window.Response("{}"));
    }, [CASES, LAST]);
    const before = await page.evaluate(() => caches.keys());
    expect(before.some((k) => /^hedact-v\d+(?:\.\d+)?$/.test(k)) && before.includes("transformers-cache"), before.join(",")).toBe(true);

    // the deploy: this address now serves the forward
    site.state.root = forwardSite();
    await page.reload();
    await expect.poll(() => settled(page, () => navigator.serviceWorker.getRegistrations().then((r) => r.length)), { timeout: 30000 }).toBe(0);
    await expect.poll(() => settled(page, () => caches.keys()), { timeout: 30000 }).toEqual([]);
    await expect(page.locator("main p")).toHaveText(TEXT);
    await expect(page.getByRole("button", { name: DOWNLOAD, exact: true })).toBeVisible();
    expect(await page.evaluate(() => [localStorage.getItem("redact-cases"), localStorage.getItem("redact-profile-last")].map((s) => JSON.parse(s))))
      .toEqual([CASES, LAST]);
    // and the worker that did it is gone for good: a reload is served by nobody but the network
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
    await expect(page.locator("main p")).toHaveText(TEXT);
  } finally {
    site.server.close();
  }
});

test("a file the moved page downloads, imported in the tool, brings every case; importing it again adds numbered copies", async ({ page, context }) => {
  const site = await serve(forwardSite());
  try {
    // the old address, where the cases are
    const old = await context.newPage();
    const outside = await guard(old);
    await seedOld(old, { "redact-cases": CASES, "redact-profile-last": LAST });
    await old.goto(site.base + "/index.html");
    const [dl] = await Promise.all([old.waitForEvent("download"), old.getByRole("button", { name: DOWNLOAD, exact: true }).click()]);
    // a short path: on Windows a file chosen from a path over 260 characters reads as "not found"
    const saved = path.join(tempDir("cases-"), dl.suggestedFilename());
    await dl.saveAs(saved);
    expect(outside).toEqual([]);
    await old.close();

    // the new address: the tool, signed in to an account with nothing saved yet
    await H.serveEngineWithStub(page);
    await page.addInitScript(() => { window.__inkStoreSuffix = "acct-1"; });
    await H.boot(page);
    await expect(page.locator("[data-case]")).toHaveCount(0);
    const importIt = async () => {
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "ייבוא תיקים מקובץ", exact: true }).click();
      await (await chooser).setFiles(saved);
    };
    const stored = () => page.evaluate(() => [localStorage.getItem("redact-cases:acct-1"), localStorage.getItem("redact-profile-last:acct-1")].map((s) => JSON.parse(s)));

    // the saved-cases list is what she sees of it, with the one line the owner approved (7.10.2026)
    await importIt();
    for (const name of Object.keys(CASES)) await expect(page.locator(`[data-case="${name}"]`)).toBeVisible();
    await expect(page.getByText(LAST_CARD)).toBeVisible();
    await expect(page.locator("[data-notice]")).toContainText("התיקים מהקובץ נוספו לרשימת התיקים.");
    expect(await stored()).toEqual([CASES, LAST]);

    // the same file again: nothing is overwritten, each case comes in under the next free number
    await importIt();
    const copies = Object.fromEntries(Object.entries(CASES).map(([n, p]) => [n + " 2", { ...p, name: n + " 2" }]));
    for (const name of [...Object.keys(CASES), ...Object.keys(copies)]) await expect(page.locator(`[data-case="${name}"]`)).toBeVisible();
    await expect(page.locator("[data-notice]")).toContainText("התיקים מהקובץ נוספו לרשימת התיקים.");
    expect(await stored()).toEqual([{ ...CASES, ...copies }, LAST]);
  } finally {
    site.server.close();
  }
});
