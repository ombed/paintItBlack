const { test, expect } = require("./base");
const H = require("./helpers");

// the service worker fetches the CDN itself, where page routes do not reach
test.use({ serviceWorkers: "block" });

/* The supply chain (outside review H14, M4, M2). The libraries that see her document are served
   by the site itself; the runtime's WebAssembly comes from the CDN and is checked against a
   pinned SHA-256 before the runtime gets it; the model is pinned to a commit. The real model
   path runs in e2e/model.spec.js, which downloads it; here nothing is downloaded. */

test("a runtime WebAssembly that is not the pinned file is refused, and the model does not load", async ({ page }) => {
  test.info().annotations.push({ type: "no-self-check" }); // no document is loaded
  await page.route("https://huggingface.co/**", (r) => r.abort());
  let served = 0;
  await page.route("https://cdn.jsdelivr.net/npm/onnxruntime-web@*/dist/*.wasm", (r) => { served++; return r.fulfill({ status: 200, contentType: "application/wasm", body: Buffer.from("not the runtime") }); });
  const fromCdn = [];
  page.on("request", (r) => { if (/cdn\.jsdelivr\.net\/npm\/@huggingface|pdfjs-dist/.test(r.url())) fromCdn.push(r.url()); });
  await H.boot(page);
  const r = await page.evaluate(async () => {
    const E = await import("./redact-engine.js");
    try { await E.nerLoad(); return { loaded: true }; } catch (e) { return { loaded: false, msg: String(e.message || e) }; }
  });
  expect(r.loaded).toBe(false);
  expect(r.msg).toContain("אינה הקובץ הנעול");
  expect(served).toBe(1);
  // the library itself came from the site, not the CDN
  expect(fromCdn).toEqual([]);
});

test("the model can be deleted from the computer in the settings", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.addInitScript(() => { window.__ner = { env: { local: false, canCache: true, canRun: true }, cached: true }; });
  await H.boot(page);
  await page.evaluate(async () => { const c = await window.caches.open("transformers-cache"); await c.put("https://huggingface.co/x/resolve/r/config.json", new window.Response("{}")); });
  const settings = page.locator("[data-settings-toggle]");
  if ((await settings.getAttribute("aria-expanded")) !== "true") await settings.click();
  await page.locator("[data-model-forget]").click();
  await expect(page.locator("[data-notice]")).toContainText("המודל והקבצים השמורים נמחקו מהמחשב");
  expect(await page.evaluate(() => window.caches.has("transformers-cache"))).toBe(false);
  await expect(page.locator("[data-model-forget]")).toHaveCount(0);
});
