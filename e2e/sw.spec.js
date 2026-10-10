const { test, expect } = require("./base");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { SITE_FILES } = require("../scripts/build-site.js");

/* The service worker (sw.js) as a returning visitor meets it: across an update, and without a network.

   1. An update. The new page comes from the network while the old worker still controls it, and the
      new worker takes over about two seconds later. The version chip asked once, got the old worker's
      answer and kept «מוגש v59 — רענון בלי מטמון» on screen until the next visit, though everything was
      already new (found live on v60). It must end as the page's own chip, and keep the warning when no
      new worker comes, because then the mismatch is real.
   2. Offline after one visit. The worker kept React and the fonts only when they were asked for while it
      already controlled the page: the first visit's React came before it, the fonts of a screen not yet
      opened never came, and every update deleted them with the old cache. Offline, the tool then stuck
      on its loading screen, or drew the document in a system font (found live on v60).

   Both run on a server of their own: what sw.js says changes between visits here, and the shared
   server must not change under the other specs. */

const ROOT = path.join(__dirname, "..");
const PAGE_V = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/<div id="ver">גרסה (v\d+(?:\.\d+)?)<\/div>/) || [])[1];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

// the repository on a free port; state.worker: "old" serves sw.js as version v1, "fails" answers 500,
// and holdMs keeps sw.js back that long (the new worker arrives after the page has asked)
function serveRepo() {
  const state = { worker: "current", holdMs: 0 };
  const server = http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(req.url.split("?")[0]); } catch (_) { res.writeHead(400).end(); return; }
    const file = path.join(ROOT, url === "/" ? "/index.html" : url);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    const send = () => fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      const body = url === "/sw.js" && state.worker === "old" ? buf.toString("utf8").replace(/const V="hedact-v\d+(?:\.\d+)?";/, 'const V="hedact-v1";') : buf;
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
    });
    if (url === "/sw.js" && state.worker === "fails") { res.writeHead(500).end(); return; }
    if (url === "/sw.js" && state.holdMs) { setTimeout(send, state.holdMs); return; }
    send();
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ state, server, base: "http://127.0.0.1:" + server.address().port })));
}

const seen = () => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} };
const controlled = (page) => page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
const workerSays = (page) => page.evaluate(() => new Promise((ok) => {
  navigator.serviceWorker.addEventListener("message", (e) => ok(e.data && e.data.sw), { once: true });
  navigator.serviceWorker.controller.postMessage("version");
}));

test("after an update the version chip ends as the page's own, and warns only while the old worker stays", async ({ page }) => {
  const { state, server, base } = await serveRepo();
  try {
    await page.addInitScript(seen);
    // the visitor's last visit: an older worker installed itself and controls the page
    state.worker = "old";
    await page.goto(base + "/index.html");
    await controlled(page);
    expect(await workerSays(page)).toBe("hedact-v1");
    await page.reload();
    await expect(page.locator("#ver")).toContainText("יש גרסה חדשה");

    // the new worker cannot be had: the old one keeps serving, and the warning is true and stays
    state.worker = "fails";
    await page.reload();
    await expect(page.locator("#ver")).toContainText("יש גרסה חדשה");
    await page.waitForTimeout(4000);
    await expect(page.locator("#ver")).toContainText("יש גרסה חדשה");

    // the update: the old worker answers first, the new one takes over, and the chip is the page's own
    state.worker = "current";
    state.holdMs = 1500;
    await page.reload();
    await expect(page.locator("#ver")).toContainText("יש גרסה חדשה");
    await expect(page.locator("#ver")).toHaveText("גרסה " + PAGE_V, { timeout: 20000 });
    expect(await workerSays(page)).toBe("hedact-" + PAGE_V);
  } finally {
    server.close();
  }
});

test("after one visit the tool starts and keeps its look without a network", async ({ page, context }) => {
  const { server, base } = await serveRepo();
  try {
    await page.addInitScript(seen);
    await page.goto(base + "/index.html");
    await controlled(page);
    // the worker's install kept what the tool needs to start and to look right: React as the runtime
    // loads it, and every font the site publishes
    const support = fs.readFileSync(path.join(ROOT, "support.js"), "utf8");
    const react = ["REACT_URL", "REACT_DOM_URL"].map((k) => (support.match(new RegExp("var " + k + ' = "([^"]+)"')) || [])[1]);
    const fonts = SITE_FILES.filter((f) => /^fonts\/.*\.woff2$/.test(f)).map((f) => base + "/" + f);
    expect(fonts.length).toBeGreaterThanOrEqual(19);
    const kept = await page.evaluate(async () => {
      const name = (await caches.keys()).find((k) => k.startsWith("hedact-"));
      return name ? (await (await caches.open(name)).keys()).map((r) => r.url) : [];
    });
    for (const u of [...react, ...fonts]) expect(kept, "kept at install: " + u).toContain(u);

    // offline: the tool starts, and the tour's invented sample reaches the check screen in its own fonts
    const failed = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#dc-root")).toBeAttached({ timeout: 30000 });
    await expect(page.locator("#boot")).toHaveCount(0);
    await page.locator("[data-tour-start]").click();
    const tour = page.locator("[data-tour]");
    await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
    await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
    await tour.getByRole("button", { name: "המשך", exact: true }).click();
    await expect(tour).toContainText("יישובים", { timeout: 20000 });
    await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
    await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return { failed: [...document.fonts].filter((f) => f.status === "error").map((f) => f.family + " " + f.weight),
        doc: document.fonts.check('400 16px "Noto Serif Hebrew"', "שלום"), ui: document.fonts.check("400 16px Rubik", "שלום"),
        name: document.fonts.check('900 24px "Frank Ruhl Libre"', "אינקוגניטו") };
    });
    expect(faces).toEqual({ failed: [], doc: true, ui: true, name: true });
    expect(failed.filter((u) => /\/fonts\/|unpkg\.com\/react/.test(u)), "nothing the tool needs failed offline").toEqual([]);
    await context.setOffline(false);
  } finally {
    server.close();
  }
});
