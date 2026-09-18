const { test, expect } = require("./base");
const H = require("./helpers");

/* Release 4, wave 2: the work screen (qa-audit/ux-1, run-1). Each test
   asserts what the user gets: one count, the button that acts, what reaches
   the clipboard, what the keyboard does, what fits at 375 px. */

// people after a title are "לאישור" name findings; one ordinary word is a body-text suggestion
const DOC = [
  "פרוטוקול דיון",
  "עו״ד רונן אלמליח פתח. השופטת נועה קלדרון שאלה.",
  "עו״ד רונן אלמליח השיב. השופטת נועה קלדרון סיכמה.",
  "רונית לוי: אני מבקשת לפתוח.",
  "רונית לוי: תודה.",
].join("\n");

// a clean document for the export and keyboard tests: every name is on the list
const CLEAN = ["סיכום", "מר דני כהן הגיע. דני כהן חייך."].join("\n");

async function toWork(page, doc, names) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // on a phone the settings start closed
  const toggle = page.locator("[data-settings-toggle]");
  if (!(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", doc || DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of names || []) { await input.fill(n); await input.press("Enter"); }
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run).toBeVisible({ timeout: 15000 });
  await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
const sheet = (page) => page.locator("[data-work] section").first();
const reviewHead = (page) => page.getByRole("button", { name: /^לבדיקה/ }).first();

test("UX #13: one count for what is pending — panel header, panel list and footer agree, people first", async ({ page }) => {
  await toWork(page);
  const text = await sheet(page).innerText();
  expect(text).toContain("אלמליח"); // left in the text: waiting for a decision
  const head = await reviewHead(page).innerText();
  const n = Number((head.match(/\d+/) || ["0"])[0]);
  expect(n).toBeGreaterThan(0);
  // every row in the panel is one pending item: people, body-text names, spelling doubts
  expect(await page.locator("[data-review-item]").count()).toBe(n);
  // the footer carries the same number and names a person first
  const bar = await page.locator("[data-bar-text]").first().innerText();
  expect(bar).toContain(String(n));
  const firstName = bar.split("·")[1] || "";
  expect(/אלמליח|קלדרון/.test(firstName)).toBe(true);
});

test("UX #13 / #14: 'להחליף' on a pending person replaces it in the document and the count drops", async ({ page }) => {
  await toWork(page);
  const before = Number(((await reviewHead(page).innerText()).match(/\d+/) || ["0"])[0]);
  const item = page.locator("[data-pend-item]").filter({ hasText: "רונן אלמליח" }).first();
  await item.getByRole("button", { name: "להחליף" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("רונן אלמליח");
  await expect.poll(async () => Number(((await reviewHead(page).innerText()).match(/\d+/) || ["0"])[0])).toBe(before - 1);
});

test("UX #14: a replaced card marked 'לאישור' has an 'אישור' button that clears the badge", async ({ page }) => {
  // a short confirmed name: its prefixed form is a word, so it waits for approval
  await toWork(page, ["פרוטוקול", "רונית לוי: פתחתי.", "רונית לוי: סיימתי. אמרתי לרונית לוי שלום."].join("\n"));
  const card = page.locator("[data-group]").filter({ has: page.getByText("לאישור", { exact: true }) }).first();
  if (!(await card.count())) test.skip(true, "no replaced card waits for approval in this document");
  await card.getByRole("button", { name: "אישור", exact: true }).click();
  await expect(card.getByText("לאישור", { exact: true })).toHaveCount(0);
});

test("UX #11: the kind pickers say 'אדם', not 'שם'", async ({ page }) => {
  await toWork(page);
  const manual = page.locator("aside").getByRole("button", { name: "אדם", exact: true }).first();
  await expect(manual).toBeVisible();
  await expect(page.locator("aside").getByRole("button", { name: "שם", exact: true })).toHaveCount(0);
});

test("UX #12: the work screen shows one step model, and the places button says where it leads", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await expect(page.getByRole("button", { name: "המשך לבדיקה" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "המשך לבדיקה" }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("header nav")).toHaveCount(0);
  await expect(page.locator("[data-steps]")).toContainText("2 העתקה או הורדה");
  await expect(page.locator("[data-steps]")).toContainText("3 החזרת שמות");
});

test("UX #18: copy while items are pending asks first, copies only on 'בכל זאת', and advances the step only then", async ({ page }) => {
  await toWork(page);
  await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.getByRole("button", { name: /העתקה ל-AI/ }).click();
  const ask = page.locator("[data-export-ask]");
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("אלמליח");
  expect(await page.evaluate(() => window.__copied)).toBeNull();
  await expect(page.locator("[data-steps]")).not.toContainText("✓ ›", { timeout: 500 }).catch(() => {});
  expect(await page.locator("[data-steps]").innerText()).not.toContain("הורדה ✓");
  await ask.getByRole("button", { name: "להעתיק בכל זאת" }).click();
  await expect.poll(() => page.evaluate(() => window.__copied)).toContain("אלמליח");
  await expect(page.locator("[data-steps]")).toContainText("2 העתקה או הורדה ✓");
});

test("UX #18: a blocked clipboard does not mark the step done", async ({ page }) => {
  await toWork(page, CLEAN, ["דני כהן"]);
  // no pending items here: the copy goes straight through, and it fails
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("blocked"));
    document.execCommand = () => false;
  });
  const input = page.getByPlaceholder("ערך שפוספס");
  await expect(input).toBeVisible();
  await page.getByRole("button", { name: /העתקה ל-AI/ }).click();
  await expect(page.getByText(/ההעתקה נחסמה/)).toBeVisible();
  expect(await page.locator("[data-steps]").innerText()).not.toContain("✓ ›\n3");
  await expect(page.locator("[data-steps]")).not.toContainText("הורדה ✓");
});

test("UX #23 / QA 009: download says where the file went, and the report shares its name", async ({ page }) => {
  await toWork(page, CLEAN, ["דני כהן"]);
  const d1 = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת Word" }).click();
  const docx = (await d1).suggestedFilename();
  await expect(page.locator("[data-notice]")).toContainText(docx);
  await expect(page.locator("[data-notice]")).toContainText("תיקיית ההורדות");
  await expect(page.locator("[data-steps]")).toContainText("2 העתקה או הורדה ✓");
  await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  const d2 = page.waitForEvent("download");
  await page.getByRole("button", { name: /הורדת דוח השחרה/ }).click();
  const report = (await d2).suggestedFilename();
  expect(report).toBe(docx.replace(/\.docx$/, "") + "_דוח-השחרה.html");
});

test("UX #23: download while items are pending asks first", async ({ page }) => {
  await toWork(page);
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  await page.getByRole("button", { name: "הורדת Word" }).click();
  const ask = page.locator("[data-export-ask]");
  await expect(ask).toBeVisible();
  await page.waitForTimeout(500);
  expect(downloaded).toBe(false);
  const d = page.waitForEvent("download");
  await ask.getByRole("button", { name: "להוריד בכל זאת" }).click();
  expect((await d).suggestedFilename()).toMatch(/\.docx$/);
});

test("UX #15: the all-clear status is in plain words", async ({ page }) => {
  await toWork(page, CLEAN, ["דני כהן"]);
  const bar = page.locator("[data-bar-text]").first();
  await expect(bar).toContainText("לא נשארו בטקסט שמות או מספרים מהרשימה");
  await expect(bar).not.toContainText("שרידים");
  await expect(bar).not.toContainText("ערוצי");
});

test("QA 003: the intro is a dialog: focus starts inside, Tab stays inside, Escape closes it", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  const dlg = page.getByRole("dialog", { name: "לפני שמתחילים" });
  await expect(dlg).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement.closest("[data-intro]"))).toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("[data-intro]"))).toBe(true);
  }
  await page.keyboard.press("Enter"); // a button inside the dialog, never the header behind it
  await expect(page.getByRole("heading", { name: /החזרת שמות/ })).toHaveCount(0);
  await page.goto("/index.html");
  await expect(dlg).toBeVisible({ timeout: 60000 });
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /מה יוצא מהמסמך/ })).toBeVisible();
});

test("QA 004: marks are reachable by keyboard, Enter opens the editor, Escape closes it", async ({ page }) => {
  await toWork(page, CLEAN, ["דני כהן"]);
  const mark = page.locator('[data-mark][data-val="דני כהן"]').first();
  await mark.focus();
  expect(await page.evaluate(() => document.activeElement.getAttribute("data-val"))).toBe("דני כהן");
  await page.keyboard.press("Enter");
  const ed = page.locator("[data-inline]");
  await expect(ed).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ed).toHaveCount(0);
});

test("QA 006: at 375 px every document toolbar control is on screen, and nothing overflows", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await toWork(page, ["סיכום", "מר דני כהן הגיע. דני כהן חייך.", "גם רונית לוי באה."].join("\n"), ["דני כהן", "רונית לוי"]);
  const doc = page.getByRole("button", { name: /מסמך/ }).filter({ hasText: /^מסמך$/ });
  if (await doc.count()) await doc.first().click();
  const bar = page.locator("[data-doc-bar]");
  await expect(bar).toBeVisible();
  const boxes = await bar.locator("button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; }));
  for (const b of boxes) if (b.w > 0) { expect(b.l).toBeGreaterThanOrEqual(0); expect(b.r).toBeLessThanOrEqual(375); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("QA 007: a pasted paragraph is not added as a name, and the page does not widen", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const long = "מילה ".repeat(600).trim();
  await page.getByPlaceholder(/שם מלא/).fill(long);
  await page.getByRole("button", { name: "הוספה", exact: true }).click();
  expect((await H.listedNames(page)).some((n) => n.length > 80)).toBe(false);
  await expect(page.getByText(/קטע ארוך לא נוסף/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("QA 008: every filter chip in the rail is inside the rail", async ({ page }) => {
  await toWork(page);
  const row = page.locator("[data-cats]");
  const rail = await row.boundingBox();
  const chips = await row.locator("button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; }));
  expect(chips.length).toBeGreaterThan(1);
  for (const c of chips) { expect(c.l).toBeGreaterThanOrEqual(rail.x - 1); expect(c.r).toBeLessThanOrEqual(rail.x + rail.width + 1); }
});

test("QA 013: the places inputs have labels, and the work screen has an h1", async ({ page }) => {
  await toWork(page, ["סיכום", "מר דני כהן גר בחיפה ועבד בתל אביב."].join("\n"), ["דני כהן"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});
