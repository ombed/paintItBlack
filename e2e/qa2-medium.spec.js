const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* Second QA audit (qa-audit/run-2): the Medium and Low items. One test per
   item that has a user-visible outcome. */

const sheet = (page) => page.locator("[data-work] section").first();

async function toWork(page, doc, names) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of names || []) { await input.fill(n); await input.press("Enter"); }
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}
const DOC = ["פרוטוקול", "מרים לוין: אני מבקשת לפתוח. הפגישה נקבעה ל-14.3.2026.", "מרים לוין: למרים יש טענות. ת.ז. 034567891."].join("\n");

test("M1: a case name typed during the tour does not follow the next real document", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("שמירה");
  await page.getByPlaceholder(/שם התיק/).fill("תיק-מהסיור");
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await tour.getByRole("button", { name: "סיום" }).click();
  await expect(tour).toHaveCount(0);
  // a real document now
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-case-field] input")).toHaveValue("");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
  const cases = await page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}"));
  expect(Object.keys(cases)).not.toContain("תיק-מהסיור");
});

test("M2: model findings of the previous document are not pending on the next one", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // the model finds a person in document A only
  // found twice, so the guard treats it as a real find; she takes it off the list in document A
  await page.evaluate(() => { window.__ner = { names: (t) => (t.includes("אלפא") ? ["גדי פרץ"] : []), n: () => 2 }; });
  await H.upload(page, "alpha.docx", ["מסמך אלפא", "שירה ברקוביץ: פתחתי.", "שירה ברקוביץ: גדי פרץ הגיע. גדי פרץ ישב."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 30000 });
  await expect.poll(() => H.listedNames(page), { timeout: 15000 }).toContain("גדי פרץ");
  await H.peopleRows(page).filter({ hasText: "גדי פרץ" }).first().getByRole("button", { name: "הסרה" }).click();
  await H.goOn(page);
  let run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  // a different client's document, model off
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "beta.docx", ["מסמך בטא", "דוד כהן: פתחתי.", "דוד כהן: סיימתי."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("[data-bar]")).not.toContainText("גדי פרץ");
  await expect(page.locator("[data-work]")).not.toContainText("גדי פרץ");
});

test("M3: after 'same person as', the restore returns the person she merged into", async ({ page }) => {
  const D = ["פרוטוקול", "שירה ברקוביץ: פתחתי.", "לאה ברקוביץ: אני הסבתא.", "שירה ברקוביץ: תודה.", "לאה ברקוביץ: בבקשה."].join("\n");
  await toWork(page, D);
  // decline nothing: the two reach the check screen apart, then merge לאה into שירה from the card
  const leaBefore = (await page.locator('[data-mark][data-val="לאה ברקוביץ"]').first().innerText()).trim();
  const fake = (await page.locator('[data-mark][data-val="שירה ברקוביץ"]').first().innerText()).trim();
  const card = page.locator("[data-group]").filter({ has: page.locator("span:first-child", { hasText: /^לאה ברקוביץ$/ }) }).first();
  await card.locator("span:first-child").first().click();
  await card.getByRole("combobox").first().selectOption("שירה ברקוביץ");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain(leaBefore);
  expect((await sheet(page).innerText()).split(fake).length - 1).toBeGreaterThanOrEqual(4);
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(`${fake} הגיעה לדיון.`);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("[data-rv-out]")).toContainText("שירה ברקוביץ הגיעה לדיון.");
  await expect(page.locator("[data-rv-result]")).toContainText("שם אחד הוחזר");
  await expect(page.getByText(/לא נמצא אף שם חלופי/)).toHaveCount(0);
});

test("M7: deleting from the profile list is one undo step of its own, with a notice", async ({ page }) => {
  await toWork(page, DOC);
  // an earlier, unrelated change: the ID becomes a label
  await page.locator('[data-mark][data-val="034567891"]').first().click();
  await page.locator("[data-inline]").getByRole("button", { name: /תווית|שם/ }).first().click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toMatch(/\[/);
  const labelled = await sheet(page).innerText();
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  const row = page.locator("[data-mine] > div").filter({ hasText: "מרים לוין" }).first();
  await row.getByRole("button", { name: "הסרה מהרשימה" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("מרים לוין");
  const notice = page.locator("[data-notice]");
  await expect(notice).toContainText("מרים לוין");
  // one undo brings the rule back and leaves the label alone
  await notice.getByRole("button", { name: /ביטול/ }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("מרים לוין");
  expect(await sheet(page).innerText()).toMatch(/\[/);
});

test("M5: Enter on a mark moves focus into the editor, and Escape brings it back to the mark", async ({ page }) => {
  await toWork(page, DOC);
  const mark = page.locator('[data-mark][data-val="מרים לוין"]').first();
  await mark.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-inline]")).toBeVisible();
  const inside = await page.evaluate(() => !!(document.activeElement && document.activeElement.closest("[data-inline]")));
  expect(inside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-inline]")).toHaveCount(0);
  const back = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-val"));
  expect(back).toBe("מרים לוין");
});

test("M4: the editor follows its mark when the document pane scrolls, and closes when the mark leaves the screen", async ({ page }) => {
  const LONG = ["פרוטוקול"].concat(Array.from({ length: 40 }, (_, i) => `דוד כהן: שורה ${i + 1} של הדיון, בלי שום דבר מיוחד.`)).concat(["מרים לוין: אני מבקשת לפתוח.", "מרים לוין: סיימתי."]).join("\n");
  await toWork(page, LONG);
  const mark = page.locator('[data-mark][data-val="מרים לוין"]').first();
  await mark.scrollIntoViewIfNeeded();
  await mark.click();
  const ed = page.locator("[data-inline]");
  await expect(ed).toBeVisible();
  const top0 = (await ed.boundingBox()).y, m0 = (await mark.boundingBox()).y;
  // the scrolling pane is the section's own scroll box (the document paper sits inside it)
  const scrollPane = (by) => sheet(page).evaluate((el, by) => { const p = [el, ...el.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto" && d.scrollHeight > d.clientHeight); if (by === null) p.scrollTop = 0; else p.scrollTop += by; }, by);
  await scrollPane(-120);
  await page.waitForTimeout(300);
  const top1 = (await ed.boundingBox()).y, m1 = (await mark.boundingBox()).y;
  expect(Math.round(top1 - top0)).toBe(Math.round(m1 - m0));
  await scrollPane(null);
  await expect(ed).toHaveCount(0);
});

test("M6: on a phone, tapping a mark keeps the document on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // settings are folded on a phone
  await page.locator("[data-settings-toggle]").click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const mark = page.locator('[data-mark][data-val="מרים לוין"]').first();
  await mark.click();
  await expect(page.locator("[data-inline]")).toBeVisible();
  await expect(mark).toBeVisible();
  expect(await mark.evaluate((el) => !!el.offsetParent)).toBe(true);
});

async function tourToWork(page) {
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  return tour;
}
const spotMatches = (page, sel) => page.evaluate((sel) => {
  const s = document.querySelector("[data-spot]"), t = document.querySelector(sel);
  if (!s || !t) return false;
  const a = s.getBoundingClientRect(), b = t.getBoundingClientRect();
  return Math.abs(a.top - (b.top - 6)) <= 1 && Math.abs(a.height - (b.height + 12)) <= 1;
}, sel);

test("L1, L2, L4: the spotlight sits exactly on its target, step 5 marks the case field, and the report is blocked in the tour", async ({ page }) => {
  const tour = await tourToWork(page);
  await expect.poll(() => spotMatches(page, "[data-tour-target=people]"), { timeout: 5000 }).toBe(true);
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  await expect.poll(() => spotMatches(page, "[data-tour-target=places]"), { timeout: 5000 }).toBe(true);
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("שמירה");
  await expect.poll(() => spotMatches(page, "[data-tour-target=case]"), { timeout: 5000 }).toBe(true);
  // the report download is refused like copy and Word
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await page.getByRole("button", { name: /הורדת דוח השחרה/ }).click();
  await expect(page.getByText(/בסיור אין הורדת דוח/)).toBeVisible();
  expect(downloaded).toBe(false);
});

test("L5: the notice is centred on the screen in RTL", async ({ page }) => {
  await toWork(page, DOC);
  await page.locator('[data-mark][data-val="מרים לוין"]').first().click();
  await page.locator("[data-inline]").getByRole("button", { name: "אל תחליף" }).click();
  const n = page.locator("[data-notice]");
  await expect(n).toBeVisible();
  const b = await n.boundingBox(), w = page.viewportSize().width;
  expect(Math.abs(b.x + b.width / 2 - w / 2)).toBeLessThanOrEqual(2);
});

test("L8, L20: a phone opens each screen at the top, and the document has room", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator("[data-settings-toggle]").click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await page.evaluate(() => window.scrollTo(0, 400));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 300));
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const paper = await page.locator("[data-paper]").evaluate((el) => ({ w: el.getBoundingClientRect().width, pad: parseFloat(getComputedStyle(el).paddingLeft) }));
  // the text column: before, 60 px of paper padding on each side left about 210 px
  expect(paper.pad).toBeLessThanOrEqual(16);
  expect(paper.w - 2 * paper.pad).toBeGreaterThan(290);
});

test("L10: the page behind the intro does not scroll", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.goto("/index.html");
  await expect(page.getByText("לפני שמתחילים")).toBeVisible({ timeout: 60000 });
  await page.mouse.move(300, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
});

const TOWNS = ["פרוטוקול", "דוד מזרחי: אני גר בחולון ועובד ברמת גן, ונוסע לבת ים ולראשון לציון.", "דוד מזרחי: אחי גר בנתניה."].join("\n");
async function toPlaces(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", TOWNS);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("יישובים", { timeout: 20000 });
}

test("L12: 'קבוצה אחרת' keeps what she typed and replaces the rest", async ({ page }) => {
  await toPlaces(page);
  const box = page.getByLabel("היישוב שיבוא במקום חולון");
  await box.fill("ירוחם");
  const other = page.getByLabel("היישוב שיבוא במקום נתניה");
  const before = await other.inputValue();
  await page.getByRole("button", { name: "קבוצה אחרת" }).click();
  await expect(page.getByLabel("היישוב שיבוא במקום חולון")).toHaveValue("ירוחם");
  await expect(page.locator("[data-notice]")).toContainText("התחליף שהקלדת נשאר");
  expect(await page.getByLabel("היישוב שיבוא במקום נתניה").inputValue()).not.toBe(before);
});

test("L13: map labels of neighbouring towns do not overlap", async ({ page }) => {
  await toPlaces(page);
  const show = page.getByRole("button", { name: /הצגת המפה/ });
  if (await show.isVisible().catch(() => false)) await show.click();
  await expect(page.locator("text=חולון").first()).toBeVisible();
  const overlaps = await page.evaluate(() => {
    const r = [...document.querySelectorAll("[data-map-label] > span")].map((s) => s.getBoundingClientRect()).filter((b) => b.width > 0);
    // two maps side by side: compare labels within the same map only
    const groups = {}; for (const b of r) (groups[b.left < innerWidth / 2 ? "L" : "R"] = groups[b.left < innerWidth / 2 ? "L" : "R"] || []).push(b);
    let n = 0;
    for (const g of Object.values(groups)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const a = g[i], b = g[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++;
    }
    return { n, count: r.length };
  });
  expect(overlaps.count).toBeGreaterThan(3);
  expect(overlaps.n).toBe(0);
});

test("L6: the theme follows the OS until she chooses one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await H.serveEngineWithStub(page);
  await H.boot(page);
  expect(await page.evaluate(() => localStorage.getItem("redact-theme"))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false);
  // her own choice is kept
  await page.getByRole("button", { name: "מצב יום או לילה" }).click();
  expect(await page.evaluate(() => localStorage.getItem("redact-theme"))).toBe("dark");
});

test("L7: a valid file clears the error of the previous one", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles("qa-audit/run-2/fixtures/case-empty.docx");
  await expect(page.locator("[data-file-err]")).toBeVisible();
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles("qa-audit/run-2/fixtures/latin.pdf");
  await expect(page.getByText("latin.pdf")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-file-err]")).toHaveCount(0);
});

test("L9: a deleted ID changed to a label keeps its type", async ({ page }) => {
  await toWork(page, DOC);
  const del = page.locator('[data-mark][data-val="034567891"]').first();
  await expect(del).toHaveText("∅");
  await del.click();
  await page.locator("[data-inline]").getByRole("button", { name: "תווית" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toMatch(/\[ת[״"]ז א׳\]/);
  expect(await sheet(page).innerText()).not.toContain("[פרט");
});

test("L11: a rejected manual add leaves no undo step", async ({ page }) => {
  await toWork(page, DOC);
  // one real change
  await page.locator('[data-mark][data-val="מרים לוין"]').first().click();
  await page.locator("[data-inline]").getByRole("button", { name: "אל תחליף" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("מרים לוין");
  // two adds that are refused
  for (let k = 0; k < 2; k++) {
    await page.getByPlaceholder("ערך שפוספס").fill("א");
    await page.getByRole("button", { name: "הוספה והחלפה" }).click();
  }
  // one undo undoes the real change
  await page.getByRole("button", { name: "ביטול הפעולה האחרונה" }).click();
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("מרים לוין");
});

test("L15: a case deleted in another tab is not re-created by this one", async ({ page, context }) => {
  await toWork(page, DOC);
  await page.getByRole("button", { name: /הרשימה ופרופיל התיק/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("לוין נ׳ לוין");
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")))).toContain("לוין נ׳ לוין");
  const other = await context.newPage();
  await other.goto("/index.html");
  await expect(other.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await other.evaluate(() => { const m = JSON.parse(localStorage.getItem("redact-cases") || "{}"); delete m["לוין נ׳ לוין"]; localStorage.setItem("redact-cases", JSON.stringify(m)); });
  await expect(page.locator("[data-notice]")).toContainText("נמחק בלשונית אחרת");
  // the next change here does not bring it back
  await page.locator('[data-mark][data-val="מרים לוין"]').first().click();
  await page.locator("[data-inline]").getByRole("button", { name: "אל תחליף" }).click();
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")))).not.toContain("לוין נ׳ לוין");
});

test("L22: a chip removed with ✕ is not offered again as a suggestion, and the flagged legend line shows only when something waits", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const row = H.peopleRows(page).filter({ hasText: "מרים לוין" }).first();
  await row.getByRole("button", { name: "הסרה" }).click();
  await expect(page.getByText("נשארים כמו שהם:")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ מרים לוין" })).toHaveCount(0);
  const errs = [];
  page.on("console", (m) => { if (/never resolved/.test(m.text())) errs.push(m.text()); });
  await page.getByRole("button", { name: /^↩|מרים לוין/ }).first().click();
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  const flagged = await page.locator('[data-mark][data-badge="?"]').count();
  await expect(page.locator("[data-legend]")).toContainText(flagged ? "מחכה להחלטה" : "נמחק");
  if (!flagged) await expect(page.locator("[data-legend]")).not.toContainText("מחכה להחלטה");
  expect(errs).toEqual([]);
});

test("L16: if the engine fails to load, the message is plain Hebrew and offers a reload", async ({ page }) => {
  await page.route("**/redact-engine.js", (r) => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} });
  await page.goto("/index.html");
  const box = page.getByRole("alert").filter({ hasText: "הכלי לא נטען" });
  await expect(box).toBeVisible({ timeout: 30000 });
  await expect(box).not.toContainText(/Failed|fetch|module/i);
  await expect(page.locator("[data-engine-retry]")).toBeVisible();
});

test("L17: a broken profile file gives a Hebrew reason", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles("qa-audit/run-2/fixtures/profile-broken.json");
  const err = page.getByText(/טעינת הפרופיל נכשלה/);
  await expect(err).toBeVisible();
  await expect(err).not.toContainText(/Expected|position|JSON/);
  await expect(err).toContainText("ייצוא לקובץ");
});

test("L18: an empty search says it is the search, not the category", async ({ page }) => {
  await toWork(page, DOC);
  const search = page.getByPlaceholder("חיפוש בממצאים");
  if (!(await search.isVisible().catch(() => false))) await page.locator('[data-section="findings"]').click();
  await search.fill("אין-כזה");
  await expect(page.locator("[data-empty-findings]")).toContainText("אין ממצאים שמתאימים ל«אין-כזה»");
});

test("L19: the restore box has a label, and the version chip sits in a landmark", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  expect(await page.locator("#ver").evaluate((el) => !!el.closest("footer,[role=contentinfo]"))).toBe(true);
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await expect(page.getByRole("textbox", { name: "תשובת ה-AI" })).toBeVisible();
});
