const { test, expect } = require("./base");
const H = require("./helpers");
const { report } = require("../scripts/log-report.js");

/* The richer session log (before the session of 22.9). Each correction she makes
   carries what caused it: which layer proposed the value, its kind and size, the
   model's confidence band. A pseudonym change says what changed (gender, origin,
   which part), a name she adds herself says what each layer thought of it, and
   the model's run says how long it took and how sure it was. No text, ever. */

const DOC = [
  "פרוטוקול",
  "רחל פרידמן: אני מבקשת לפתוח.",
  "אבנר שטרן: הגעתי.",
  "רחל פרידמן: תודה.",
  "אבנר שטרן: נכון. גם יונתן לנדאו היה שם.",
].join("\n");

async function sessionLog(page) {
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  const btn = page.getByRole("button", { name: "העתקת יומן הסשן" });
  if (!(await btn.isVisible().catch(() => false))) await page.getByRole("button", { name: /מה נוקה מהקובץ/ }).click();
  await btn.click();
  return JSON.parse(await page.evaluate(() => window.__copied || "{}"));
}

test("each correction says what caused it, and the log still carries no text", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.addInitScript(() => { window.__ner = { names: () => ["אבנר שטרן"], cached: true }; });
  await H.boot(page);
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });

  // a new pseudonym from the editor
  await page.locator('[data-mark][data-val="רחל פרידמן"]').first().click();
  const ed = page.locator("[data-inline]");
  await ed.getByPlaceholder("תחליף אחר").fill("משה כהן");
  await ed.getByPlaceholder("תחליף אחר").press("Enter");
  await expect(ed).toHaveCount(0);
  // the change lands when the re-run finishes, and a finishing re-run closes an open editor:
  // wait for the new pseudonym, as she would see it, before opening the next one
  await expect.poll(() => page.locator("[data-work] section").first().innerText(), { timeout: 15000 }).toContain("משה כהן");
  // "don't replace" on a name the model and the speaker layer both found
  await page.locator('[data-mark][data-val="אבנר שטרן"]').first().click();
  await page.locator("[data-inline]").getByRole("button", { name: "אל תחליף" }).click();
  await expect.poll(() => page.locator("[data-work] section").first().innerText(), { timeout: 15000 }).toContain("אבנר שטרן");
  // a name she has to add herself
  const add = page.getByPlaceholder("ערך שפוספס");
  if (!(await add.isVisible().catch(() => false))) await page.getByRole("button", { name: /הוספה ידנית|ערך שפוספס/ }).first().click().catch(() => {});
  await add.fill("יונתן לנדאו");
  await add.press("Enter");
  await expect.poll(() => page.locator("[data-work] section").first().innerText(), { timeout: 15000 }).not.toContain("יונתן לנדאו");

  let log;
  await expect.poll(async () => { log = await sessionLog(page); return log.events.some((e) => e.ev === "miss"); }, { timeout: 8000 }).toBe(true);
  const ev = (name) => log.events.filter((e) => e.ev === name);

  const md = ev("model-done")[0];
  expect(md).toBeTruthy();
  expect(md).toMatchObject({ found: 1, names: 1 });
  for (const k of ["ms", "spans", "high", "mid", "low", "below"]) expect(typeof md[k]).toBe("number");

  const rs = ev("run-src")[0];
  expect(rs && rs.aList).toBeGreaterThan(0);

  const rep = ev("set-rep").pop();
  expect(rep).toMatchObject({ kind: "NAME", words: 2, part: "both", gender: "changed", style: "name" });
  expect(rep.src).toContain("s"); // a speaker in the transcript
  expect(rep.was).toBe("auto"); // she replaced the pseudonym the tool chose

  const allow = ev("allow").pop();
  expect(allow).toMatchObject({ kind: "NAME", words: 2, applied: true });
  expect(allow.src).toContain("m");
  expect(allow.src).toContain("s");
  expect(allow.band).toBe("high");

  const miss = ev("miss").pop();
  expect(miss).toMatchObject({ kind: "NAME", words: 2, occ: 1 });
  expect(typeof miss.model).toBe("string");

  // no field anywhere was refused by the guard: a refused field is a fact we meant to keep and lost
  expect(log.events.filter((e) => e.dropped).map((e) => e.ev + ":" + e.dropped)).toEqual([]);
  // the export guard would throw on text; check the log and the report both
  expect(/[֐-׿]{3,}/.test(JSON.stringify(log))).toBe(false);
  const text = report(log);
  if (process.env.SHOW_LOG_REPORT) console.log(text);
  expect(text).toContain("Misses she added herself: 1");
  expect(text).toContain("set-rep: what changed both (1)");
});

test("a page error in her session is logged as a type and a screen, never its message", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  // an error whose message holds document text, raised the way a failing handler would
  await page.evaluate(() => window.dispatchEvent(new window.ErrorEvent("error", { error: new TypeError("רחל פרידמן is undefined"), message: "רחל פרידמן" })));
  const log = await sessionLog(page);
  const pe = log.events.filter((e) => e.ev === "page-error");
  expect(pe).toEqual([expect.objectContaining({ name: "TypeError", screen: "work", tour: false })]);
  expect(/[֐-׿]{3,}/.test(JSON.stringify(log))).toBe(false);
});
