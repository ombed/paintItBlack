const { test, expect } = require("@playwright/test");

/* The check the project could not run before: drive the real browser
   through the model path and read the console it prints. Every hard bug
   here came from the model failing in ways only a browser reproduces —
   the tokenizer regex, the response headers, the offset alignment. */

const SAMPLE = [
  "פרוטוקול דיון",
  "",
  "ביום שלישי נסע יוסי כהן מחיפה לתל אביב, ומשם המשיך לבאר שבע ולירושלים.",
  "דנה לוי המתינה לו בנתניה, ואיתה היה עורך הדין אבי מזרחי ממשרד כהן ושות'.",
  "השופטת רונית אלמוג קבעה את הדיון הבא, והעובדת הסוציאלית שרה לוין הגישה תסקיר.",
].join("\n");

test("the model loads, repairs its tokenizer, and scans the whole document", async ({ page }) => {
  test.setTimeout(600000); // first run downloads the weights from huggingface

  const logs = [];
  page.on("console", (m) => logs.push(m.text()));
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // The tool opens on an onboarding overlay and remembers dismissal in
  // localStorage. Seed it, or the file input is never reachable.
  await page.addInitScript(() => {
    try { localStorage.setItem("redact-intro-seen", "1"); } catch (_) {}
  });

  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.getByText("לפני שמתחילים")).toHaveCount(0);

  // The model checkbox is the first one in the detection card.
  const modelBox = page.getByRole("checkbox").first();
  await expect(modelBox).toBeEnabled();
  if (!(await modelBox.isChecked())) await modelBox.check();

  // Build the .docx with the app's own writer, so the fixture cannot
  // drift away from what the tool actually produces.
  const bytes = await page.evaluate(async (text) => {
    const mod = await import("./text-to-docx.js");
    return Array.from(new Uint8Array(await mod.textToDocx(text)));
  }, SAMPLE);

  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
    name: "s.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(bytes),
  });

  // Accepting the file does not start the scan. The tool holds at the
  // first step of its file → people → places → check flow until the
  // continue button is pressed, so the model never loads without it.
  await expect(page.getByText("s.docx")).toBeVisible();
  await page.getByRole("button", { name: /המשך/ }).first().click();

  // 1. the tokenizer repair reports valid JSON
  await expect
    .poll(() => logs.find((l) => l.includes("טוקנייזר") && l.includes("JSON תקין")), {
      timeout: 300000,
      message: "no tokenizer-repaired line appeared",
    })
    .toBeTruthy();

  // 2. a detection line follows it
  await expect
    .poll(() => logs.find((l) => l.startsWith("זיהוי:")), { timeout: 120000 })
    .toBeTruthy();

  const detect = logs.find((l) => l.startsWith("זיהוי:"));
  console.log("   " + detect);

  // 3. it found something
  const entities = Number((detect.match(/·\s*(\d+)\s*ישויות/) || [])[1]);
  expect(entities).toBeGreaterThan(0);

  // 4. and it read the whole document, not a prefix of it. A large gap
  //    here means chunking dropped part of the text silently.
  const span = detect.match(/\((\d+)\/(\d+)\s*תווים\)/);
  expect(span).toBeTruthy();
  const [scanned, total] = [Number(span[1]), Number(span[2])];
  console.log(`   scanned ${scanned} of ${total} characters`);
  expect(scanned / total).toBeGreaterThan(0.95);

  expect(pageErrors).toEqual([]);
});
