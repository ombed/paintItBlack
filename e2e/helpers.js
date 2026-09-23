/* Shared by the browser checks. Everything here drives the real page over
   http; the only substitution is the model layer, and only where a test asks. */
const { expect } = require("@playwright/test");

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* Serve the real engine with its model-layer bindings reassigned at the end
   of the module. nerRun is a function declaration and nerEnv, nerCached are
   `let`, all in a plain export list, so the live bindings the page imports
   follow the reassignment. Behaviour comes from window.__ner:

     names(text)  -> array of names nerRun returns        (default: none)
     delay(text)  -> ms before nerRun resolves            (default: 0)
     error        -> nerRun rejects with this message
     env          -> object nerEnv returns                (default: the real one)
     cached       -> what nerCached resolves to           (default: the real one)
     failedChunks, chunks -> a model that could not read some chunks

   env and cached are read at mount, so set them with addInitScript. The
   rest are read per call, so page.evaluate after boot is fine. Every other
   line, including the generation guard, is the shipped code. */
async function serveEngineWithStub(page) {
  await page.route("**/redact-engine.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()) + [
      "",
      "/* test stub: see e2e/helpers.js */",
      "const __realNerEnv = nerEnv, __realNerCached = nerCached;",
      "nerEnv = () => (window.__ner && window.__ner.env) || __realNerEnv();",
      "nerCached = async () => {",
      "  const c = window.__ner || {};",
      "  return c.cached !== undefined ? c.cached : __realNerCached();",
      "};",
      "nerRun = async (blocks, onProgress) => {",
      "  const text = blocks.map((b) => b.text).join(' ');",
      "  const cfg = window.__ner || {};",
      "  window.__nerCalls = (window.__nerCalls || 0) + 1;",
      "  if (onProgress) onProgress(5);",
      "  await new Promise((r) => setTimeout(r, cfg.delay ? cfg.delay(text) : 0));",
      "  if (cfg.error) throw new Error(cfg.error);",
      "  const out = (cfg.names ? cfg.names(text) : []).map((v) => ({ value: v, kind: 'NAME', n: cfg.n ? cfg.n(v) : 1, score: 0.95 }));",
      "  if (cfg.failedChunks) { out.failedChunks = cfg.failedChunks; out.chunks = cfg.chunks; }",
      "  return out;",
      "};",
      "",
    ].join("\n");
    await route.fulfill({
      response: res, body,
      headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" },
    });
  });
}

// The onboarding overlay leaves the file input inert until dismissed.
async function boot(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {}
  });
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.getByText("לפני שמתחילים")).toHaveCount(0);
}

// Built with the tool's own writer, so the fixture cannot drift from it.
async function upload(page, name, text) {
  const bytes = await page.evaluate(async (t) => {
    const mod = await import("./text-to-docx.js");
    return Array.from(new Uint8Array(await mod.textToDocx(t)));
  }, text);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
    name, mimeType: DOCX, buffer: Buffer.from(bytes),
  });
  await expect(page.getByText(name)).toBeVisible();
}

// Accepting a file does not start the scan; the step button does.
const startScan = (page) => page.getByRole("button", { name: /איתור שמות/ }).click();
const scanning = (page) => page.getByRole("button", { name: "סורק את המסמך…", exact: true });
const goButton = (page) => page.getByRole("button", { name: "המשך", exact: true });
const skipButton = (page) => page.getByRole("button", { name: /המשך בלי שמות/ });
// v36 (UX #8): "המשך" with open "נמצאו גם" suggestions asks first. This presses
// "המשך" and, if asked, answers "להמשיך בלעדיהם" — the path every spec took before.
async function goOn(page) {
  await goButton(page).click();
  const skip = page.getByRole("button", { name: "להמשיך בלעדיהם", exact: true });
  if (await skip.isVisible({ timeout: 800 }).catch(() => false)) await skip.click();
}

// Each people row carries a delete button; the name is the row's own span.
const peopleRows = (page) => page.locator('div:has(> button[aria-label="הסרה"])');
const listedNames = (page) => peopleRows(page).locator("> span").allTextContents();

/* pdf.js comes from a CDN at runtime. A test that waits on a third party fails when the
   third party hiccups, which a CI run did, so the browser gets the same version from
   node_modules instead. tests/site_t.js keeps the pinned version and the one in
   pdf-text.js the same. */
/* pdf.js is served by the site itself, from vendor/ (review H14). A request for it from the CDN
   is aborted, so a regression back to a bare CDN import fails every PDF test. */
async function servePdfJsLocally(page) {
  await page.route("**/pdfjs-dist@*/**", (route) => route.abort());
}

module.exports = { servePdfJsLocally, DOCX, serveEngineWithStub, boot, upload, startScan, scanning, goButton, goOn, skipButton, peopleRows, listedNames };
