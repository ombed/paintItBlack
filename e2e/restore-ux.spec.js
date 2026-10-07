const { test, expect } = require("./base");
const H = require("./helpers");

/* The restore screen and the way to it, as the owner approved them on 6.10 (built 7.10.2026, v65):
   what is left of the invented names in the answer is listed and marked before it is copied; «חזרה
   למסמך» under the result, and the browser's Back, return to the document; after a reload the screen
   offers the last case instead of starting empty; the bottom bar's step 3 becomes a button once the text
   was copied, beside links to the known AI tools; and the saved cases have a button that clears them. */

// two people who each speak twice, so the list fills without the model
const DOC = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח.",
  "דוד כהן: אני המשיב.",
  "רחל פרידמן: תודה.",
  "דוד כהן: נסכם בכתב.",
].join("\n");

// on a phone the settings, and the model switch with them, sit behind a toggle
async function modelOff(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
}

// from a loaded document to the review screen, optionally saved under a case name
async function toWork(page, caseName) {
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  if (caseName) await page.locator("[data-case-field] input").fill(caseName);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}

async function firstDoc(page, caseName) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  await H.upload(page, "case.docx", DOC);
  await toWork(page, caseName);
}

const fakeOf = async (page, real) => (await page.locator(`[data-mark][data-val="${real}"]`).first().innerText()).trim();
const openRestore = (page) => page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
const answerBox = (page) => page.getByPlaceholder("הדבקת תשובת ה-AI…");
async function restore(page, answer) {
  await answerBox(page).fill(answer);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("[data-rv-out]")).toBeVisible();
}
// copy to the AI, as she does it; the clipboard is stubbed so the test needs no permission
async function copyToAi(page) {
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  const anyway = page.getByRole("button", { name: /בכל זאת/ });
  if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
}

/* The restore brings back what it can find; an invented name the AI glued to other letters, a surname two
   people share, or a surname too short to restore alone stays in the answer. Until v65 the screen said only
   how many names came back, and an answer with an invented name left in it looked finished. */
test("what is left of the invented names is listed with its real name and marked in the answer, before it is copied", async ({ page }) => {
  await firstDoc(page);
  const r = await fakeOf(page, "רחל פרידמן"), d = await fakeOf(page, "דוד כהן");
  await openRestore(page);

  // the AI glued a suffix to one invented name: it cannot come back, and it is said
  await restore(page, `${r} היא המבקשת. הבית של ${d}ים נמכר.`);
  const out = page.locator("[data-rv-out]");
  await expect(out, "the answer itself is whole: the marks change no letter").toHaveText(`רחל פרידמן היא המבקשת. הבית של ${d}ים נמכר.`);
  const left = page.locator("[data-rv-left]");
  await expect(left).toContainText("נשאר בתשובה פרט בדוי אחד");
  await expect(left).toContainText("הם מסומנים בתשובה. כדאי לתקן אותם ביד לפני שמשתמשים בה.");
  await expect(left.locator("li")).toHaveText([`«${d}» במקום «דוד כהן»`]);
  // marked where it stands, with the same line as its description
  const mark = out.locator("mark[data-left]");
  await expect(mark).toHaveText([d]);
  await expect(mark).toHaveAttribute("title", `«${d}» במקום «דוד כהן»`);
  // said with the result: the list is inside the status region that a screen reader reads out
  await expect(page.locator("main").getByRole("status")).toContainText("נשאר בתשובה פרט בדוי אחד");

  // twice in one answer: one line, with how many times
  await restore(page, `${d}ים אמר. ${d}ים חזר.`);
  await expect(left.locator("li")).toHaveText([`«${d}» במקום «דוד כהן» · 2 פעמים`]);
  await expect(out.locator("mark[data-left]")).toHaveCount(2);

  // everything came back: the list makes way for one line, and nothing is marked
  await restore(page, `${r} היא המבקשת, ו${d} הוא המשיב.`);
  await expect(left).toHaveCount(0);
  await expect(page.locator("[data-rv-left-none]")).toHaveText("לא נמצא בתשובה פרט בדוי שלא הוחזר.");
  await expect(out.locator("mark")).toHaveCount(0);
  await expect(out).toHaveText("רחל פרידמן היא המבקשת, ודוד כהן הוא המשיב.");
});

/* Live check, 6.10 («not getting to return from AI answer»): the restore screen had one way back, at the top,
   and the browser's Back asked whether to leave the document, when what she wanted was the document. */
test("«חזרה למסמך» under the result and the browser's Back both return to the document, with no question", async ({ page }) => {
  await firstDoc(page);
  const r = await fakeOf(page, "רחל פרידמן");
  const asked = [];
  page.on("dialog", (dl) => { asked.push(dl.message()); dl.dismiss(); });

  // the button under the result
  await openRestore(page);
  await restore(page, `${r} היא המבקשת.`);
  await expect(page.locator("[data-rv-back]")).toHaveText("חזרה למסמך");
  await page.locator("[data-rv-back]").click();
  await expect(page.locator("[data-bar]")).toBeVisible();
  await expect(answerBox(page)).toHaveCount(0);

  // the browser's Back
  await openRestore(page);
  await expect(answerBox(page)).toBeVisible();
  await page.evaluate(() => window.history.back());
  await expect(page.locator("[data-bar]")).toBeVisible();
  await expect(answerBox(page)).toHaveCount(0);
  expect(asked, "no question on the way back to the document").toEqual([]);

  // left by the button at the top, the restore screen is not left in the history: the next Back is the
  // document's own, which asks before leaving it, as before
  await openRestore(page);
  await expect(answerBox(page)).toBeVisible();
  await page.locator("[data-back]").click();
  await expect(page.locator("[data-bar]")).toBeVisible();
  await page.evaluate(() => window.history.back());
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toContain("לצאת מהמסמך?");
  await expect(page.locator("[data-bar]")).toBeVisible();
  await expect(answerBox(page)).toHaveCount(0);
});

test("with no document the restore screen has no «חזרה למסמך» under the result, and Back returns to the file screen", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await openRestore(page);
  await expect(page.locator("[data-back]")).toContainText("לבחירת מסמך");
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole("button", { name: /בחירת קובץ/ })).toBeVisible();
  await expect(answerBox(page)).toHaveCount(0);
});

/* After a reload or in a new tab there is no document and no case, but the browser keeps the last one. The
   screen asks rather than assumes, because an answer can belong to another case. */
test("after a reload the restore screen offers the last case; «שימוש בתיק הזה» restores by it, «תיק אחר» lets it go", async ({ page }) => {
  await firstDoc(page, "פרידמן נ׳ כהן");
  const r = await fakeOf(page, "רחל פרידמן");
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("redact-cases") || "{}")))).toEqual(["פרידמן נ׳ כהן"]);
  page.on("dialog", (dl) => dl.accept());
  await page.reload();
  await expect(page.getByRole("button", { name: /בחירת קובץ/ })).toBeVisible({ timeout: 60000 });

  await openRestore(page);
  const offer = page.locator("[data-rv-last]");
  await expect(offer).toContainText("להחזיר את השמות לפי התיק «פרידמן נ׳ כהן»?");
  await expect(offer).toContainText(/2 שמות ופרטים · עודכן /);
  // «תיק אחר»: the offer goes, and the screen says how to get names, as before
  await offer.getByRole("button", { name: "תיק אחר" }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.getByText("עדיין אין כאן שמות להחזרה")).toBeVisible();

  // opened again, it asks again; «שימוש בתיק הזה» restores by that case
  await page.locator("[data-back]").click();
  await openRestore(page);
  await offer.getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.getByText("השמות מתיק שמור · תיק: פרידמן נ׳ כהן")).toBeVisible();
  await restore(page, `${r} היא המבקשת.`);
  await expect(page.locator("[data-rv-out]")).toHaveText("רחל פרידמן היא המבקשת.");
});

test("a list with no case name is offered as «רשימת השמות מהפעם הקודמת», and nothing is offered when nothing is kept", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await openRestore(page);
  await expect(page.locator("[data-rv-last]")).toHaveCount(0);
  await expect(page.getByText("עדיין אין כאן שמות להחזרה")).toBeVisible();
  await page.locator("[data-back]").click();
  await modelOff(page);
  await H.upload(page, "case.docx", DOC);
  await toWork(page);
  const r = await fakeOf(page, "רחל פרידמן");
  await expect.poll(() => page.evaluate(() => !!localStorage.getItem("redact-profile-last"))).toBe(true);
  page.on("dialog", (dl) => dl.accept());
  await page.reload();
  await expect(page.getByRole("button", { name: /בחירת קובץ/ })).toBeVisible({ timeout: 60000 });
  await openRestore(page);
  const offer = page.locator("[data-rv-last]");
  await expect(offer).toContainText("להחזיר את השמות לפי רשימת השמות מהפעם הקודמת?");
  await offer.getByRole("button", { name: "שימוש ברשימה הזאת" }).click();
  await restore(page, `${r} היא המבקשת.`);
  await expect(page.locator("[data-rv-out]")).toHaveText("רחל פרידמן היא המבקשת.");
});

test("the bar's step 3 becomes a button to the restore screen once the text was copied, beside the known AI tools", async ({ page }) => {
  await firstDoc(page);
  const step3 = page.locator('[data-bar] [data-step="3"]');
  await expect(step3).toHaveText("3 החזרת שמות");
  expect(await step3.evaluate((el) => el.tagName)).toBe("SPAN");

  // the AI tools open in a new tab, with nothing filled in; one line of care beside them
  const ai = page.locator("[data-bar] [data-ai]");
  const group = ai.getByRole("group", { name: "פתיחת כלי AI בלשונית חדשה" });
  await expect(group.getByRole("link")).toHaveText(["ChatGPT", "Claude", "Gemini", "Copilot"]);
  const links = await group.getByRole("link").evaluateAll((as) => as.map((a) => [a.href, a.target, a.rel, a.title]));
  expect(links).toEqual([
    ["https://chatgpt.com/", "_blank", "noopener noreferrer", "נפתח בלשונית חדשה"],
    ["https://claude.ai/", "_blank", "noopener noreferrer", "נפתח בלשונית חדשה"],
    ["https://gemini.google.com/", "_blank", "noopener noreferrer", "נפתח בלשונית חדשה"],
    ["https://copilot.microsoft.com/", "_blank", "noopener noreferrer", "נפתח בלשונית חדשה"],
  ]);
  await expect(ai.locator("[data-ai-safety]")).toHaveText("בחשבון אישי, השיחות עשויות לשמש לאימון ה־AI, אלא אם מכבים את זה. איך מכבים");
  await expect(ai.getByRole("link", { name: "איך מכבים" })).toHaveAttribute("href", "https://inkognito.co.il/#training");

  await copyToAi(page);
  await expect(step3).toHaveText("3 החזרת שמות");
  expect(await step3.evaluate((el) => el.tagName)).toBe("BUTTON");
  await expect(step3).toHaveAttribute("title", "מעבר למסך שבו מדביקים את תשובת ה־AI");
  await step3.click();
  await expect(answerBox(page)).toBeVisible();
  await expect(page.locator("[data-back]")).toContainText("חזרה למסמך");
});

/* The saved cases hold the real client names. On a shared computer they should be easy to clear: one button,
   in the owner's approved words, that asks first and clears the cases of every account on this computer. */
test("«ניקוי התיקים מהמחשב» asks first, then clears every saved case on this computer, and only then", async ({ page }) => {
  await H.serveEngineWithStub(page);
  const p = { v: 1, name: "לוי נ׳ לוי", created: "2026-09-01T09:00:00.000Z", updated: "2026-09-01T09:00:00.000Z", mode: "real",
    rules: [{ value: "שרה לוי", kind: "NAME", replacement: "דנה רום", auto: false, g: null }], allow: [], map: { "שרה לוי": "דנה רום" }, removed: [], sent: {} };
  await page.addInitScript((p) => {
    if (window.sessionStorage.getItem("seeded")) return;
    window.sessionStorage.setItem("seeded", "1");
    localStorage.setItem("redact-cases", JSON.stringify({ [p.name]: p }));
    localStorage.setItem("redact-profile-last:acct-2", JSON.stringify({ ...p, name: "" }));
    localStorage.setItem("redact-theme", "light");
  }, p);
  await H.boot(page);
  const keys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("redact-")).sort());
  const clear = page.getByRole("button", { name: "ניקוי התיקים מהמחשב" });
  await expect(page.locator(`[data-case="${p.name}"]`)).toBeVisible();

  // «no» keeps everything
  let said = "";
  page.once("dialog", (dl) => { said = dl.message(); dl.dismiss(); });
  await clear.click();
  await expect.poll(() => said).toBe("למחוק מהמחשב הזה את כל התיקים השמורים? אי אפשר לבטל את זה.");
  expect(await keys()).toEqual(["redact-cases", "redact-intro-seen", "redact-profile-last:acct-2", "redact-theme", "redact-tour-seen"]);
  await expect(page.locator(`[data-case="${p.name}"]`)).toBeVisible();

  // «yes» clears the cases of every account, and only them
  page.once("dialog", (dl) => dl.accept());
  await clear.click();
  await expect(page.locator("[data-notice]")).toContainText("התיקים השמורים נמחקו מהמחשב.");
  expect(await keys()).toEqual(["redact-intro-seen", "redact-theme", "redact-tour-seen"]);
  await expect(page.locator("[data-case]")).toHaveCount(0);
  await expect(clear, "nothing is left to clear").toHaveCount(0);
});
