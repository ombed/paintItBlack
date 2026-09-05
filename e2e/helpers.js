/* Shared by the browser checks. Everything here drives the real page over
   http; the only substitution is the model, and only where a test asks. */
const { expect } = require("@playwright/test");

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* Serve the real engine with nerRun reassigned at the end of the module.
   nerRun is a function declaration in a plain export list, so the live
   binding the page imports follows the reassignment. The stub reads its
   timing and its answers from window.__ner, set per test, so scans are
   fast and deterministic while every other line is the shipped code. */
async function serveEngineWithStub(page) {
  await page.route("**/redact-engine.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()) + [
      "",
      "/* test stub: see e2e/helpers.js */",
      "nerRun = async (blocks, onProgress) => {",
      "  const text = blocks.map((b) => b.text).join(' ');",
      "  const cfg = window.__ner || {};",
      "  window.__nerCalls = (window.__nerCalls || 0) + 1;",
      "  if (onProgress) onProgress(5);",
      "  await new Promise((r) => setTimeout(r, cfg.delay ? cfg.delay(text) : 0));",
      "  return (cfg.names ? cfg.names(text) : []).map((v) => ({ value: v, kind: 'NAME', n: 1, score: 0.95 }));",
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
    try { localStorage.setItem("redact-intro-seen", "1"); } catch (_) {}
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

// Each people row carries a delete button; the name is the row's own span.
const listedNames = (page) =>
  page.locator('div:has(> button[aria-label="הסרה"]) > span').allTextContents();

module.exports = { DOCX, serveEngineWithStub, boot, upload, startScan, scanning, goButton, skipButton, listedNames };
