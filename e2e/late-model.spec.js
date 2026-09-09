const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* The leak from a real session, reduced to its mechanism.

   The model found the teacher's name seven times at full confidence, and the
   name left the tool anyway. The document was long, the model was still
   scanning, and "continue without waiting" bumped the scan counter, so when
   the result arrived it was thrown away whole. Nothing downstream ever saw
   the name: not the rules, not the verifier, not the status bar, which said
   the document was safe.

   Now the scan keeps running after she continues. When it finishes, its
   names go into the rules, not into the list on a screen she has left, and
   the document is processed again. This drives exactly that path with the
   model stubbed to answer slowly. */

const DOC = [
  "שיחה עם ילדה",
  "מי המורה שלך?",
  "אנטונינה. כן, למורה קוראים אנטונינה.",
  "אה, אנטונינה. והיא נחמדה?",
  "כן.",
].join("\n");

test("a name the model finds after she continued still gets replaced", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // the model answers after twelve seconds, well after she has moved on. The
  // delay has to outlast the time it takes to reach the button on a loaded
  // machine, or the scan simply finishes and the test measures nothing.
  await page.addInitScript(() => {
    window.__ner = { names: () => ["אנטונינה"], delay: () => 12000 };
  });
  await page.reload();
  await H.upload(page, "interview.docx", DOC);
  await H.startScan(page);

  // she does not wait
  const goNow = page.getByRole("button", { name: /להמשיך בלי לחכות למודל/ });
  await expect(goNow).toBeVisible({ timeout: 10000 });
  await goNow.click();

  // through the places screen if it appears, on to the check screen
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לעיבוד|המשך|עיבוד/ }).first();
  if (await run.isVisible({ timeout: 5000 }).catch(() => false)) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });

  // the late result arrives: the name is replaced in the document. The rail
  // legitimately still shows it, as the original on its findings card.
  await expect(page.locator('[data-mark][data-val="אנטונינה"]').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-work] section").first()).not.toContainText("אנטונינה");
  const marks = page.locator("[data-mark]");
  expect(await marks.count()).toBeGreaterThan(0);
  for (const t of await marks.allTextContents()) expect(t).not.toContain("אנטונינה");
});
