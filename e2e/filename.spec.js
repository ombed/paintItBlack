const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* The file name was an untracked channel for the very thing the tool exists
   to remove. It scrubs the author and the title out of the Word metadata and
   then wrote the original file name straight onto the download, so
   "תסקיר-רונית-לוי.docx" came back as "תסקיר-רונית-לוי_מושחר.docx". That name
   travels in the mail and sits in the downloads folder, and the same name was
   given to the document inside the bundle meant to be sent to us.

   The name is now scanned like any other text, so a person in it reaches the
   list, and the download name goes through the same replacements as the
   document. If anything on the list still survives in it, the tool refuses
   the name entirely and falls back to a dated one. */

const DOC = ["תסקיר בעניין המשפחה", "רונית לוי הגישה בקשה בחודש שעבר.", "הדיון נקבע בחיפה."].join("\n");

test("the file name is scanned like any other text", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // the stub records exactly what the scan was handed, which is the fact under
  // test: the file name used to reach no scanner at all, so a person named
  // only there was invisible to the tool and left on the download
  await page.addInitScript(() => {
    window.__ner = { names: (t) => (t.includes("נועה שרעבי") ? ["נועה שרעבי"] : []) };
  });
  await page.reload();
  await H.upload(page, "תסקיר-נועה-שרעבי.docx", DOC);
  await H.startScan(page);

  // the name exists nowhere but the file name, so the list can only hold it if
  // the file name reached the scan. The wait is generous: the model layer is
  // stubbed but the surrounding load is slower on a CI machine than here.
  await expect(H.goButton(page)).toBeVisible({ timeout: 60000 });
  await expect.poll(() => H.listedNames(page).then((n) => n.join(" ")), { timeout: 30000 })
    .toContain("נועה שרעבי");
});

test("the redacted download is not named after the person in the file name", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "תסקיר-רונית-לוי.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goButton(page).click();

  // straight through the places screen if it appears, then run
  const go = page.getByRole("button", { name: /החלת הקבוצה|המשך|עיבוד/ }).first();
  if (await go.isVisible().catch(() => false)) await go.click();

  const download = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: /הורדת Word/ }).click();
  const name = (await download).suggestedFilename();

  expect(name).not.toContain("רונית");
  expect(name).not.toContain("לוי");
  expect(name).toMatch(/_מושחר\.docx$/);
});
