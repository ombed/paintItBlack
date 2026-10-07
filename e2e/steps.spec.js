const { test, expect } = require("./base");
const H = require("./helpers");

/* The round trip is the everyday task: redact, send to the AI, put the real
   names back into what comes back. Restore used to be a header link. It is
   now step three, offered in the bar the moment step two (copy) happens,
   and the restore screen arrives already connected to this document. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";

test("copying unlocks step three, and the restore screen puts the real name back", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first().click();
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });

  const bar = page.locator("[data-bar]");
  await expect(bar.locator("[data-steps]")).toContainText("2 העתקה או הורדה");
  // step two is not done yet: no drawn check on it
  await expect(bar.locator('[data-step="2"]')).toHaveCount(1);
  await expect(bar.locator('[data-step="2"] svg[data-icon="check"]')).toHaveCount(0);
  // and a screen reader is told step one is done, and step two is not
  await expect(bar.locator("[data-steps]")).toMatchAriaSnapshot("- text: 1 החלפת שמות ✓ 2 העתקה או הורדה 3 החזרת שמות");
  await expect(bar.getByRole("button", { name: "הדבקת תשובת ה-AI" })).toHaveCount(0);

  await bar.getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  const copied = await page.evaluate(() => window.__copied || "");
  expect(copied).not.toContain("רונית לוי");
  const fake = copied.match(/[֐-׿]+ [֐-׿]+ הגישה/); // "<fake first> <fake last> הגישה"
  expect(fake).toBeTruthy();
  const fakeName = fake[0].replace(" הגישה", "");
  // done: the check is drawn, and a screen reader still hears the ✓ it heard before (a hidden ✓ beside it)
  await expect(bar.locator('[data-step="2"] svg[data-icon="check"]')).toBeVisible();
  await expect(bar.locator("[data-steps]")).toContainText("2 העתקה או הורדה ✓");
  // the text alone would still hold the ✓ if it were hidden from screen readers (aria-hidden, display:none);
  // the accessibility tree is what a screen reader reads
  // and step three is now a button to the restore screen (the owner's approved rs-step3, 7.10.2026)
  await expect(bar.locator("[data-steps]")).toMatchAriaSnapshot('- text: 1 החלפת שמות ✓ 2 העתקה או הורדה ✓\n- button "3 החזרת שמות"');
  /* Putting the answer back used to be reachable from three places: a button
     here in the bar, an identical one in the header, and a rail section that
     ran a different code path. That third one built its pairs from a list
     that does not drop blacked-out values, while the screen used one that
     does, so the same pasted text could come back differently depending on
     where it was pasted. One screen survives, reached by the header button,
     which is emphasised once the text has been copied, and by step three:
     both only open that screen, so there is one code path. No paste box in the bar. */
  await expect(bar.getByRole("button", { name: "הדבקת תשובת ה-AI" })).toHaveCount(0);
  const step3 = page.getByRole("button", { name: "החזרת שמות מתשובת AI" });
  await expect(step3).toBeVisible();
  await expect(step3).toHaveCSS("font-weight", "500");

  // step three: the AI's answer comes back with the fake name; the real one returns
  await step3.click();
  await expect(page.getByText("השמות מהמסמך שבעבודה")).toBeVisible();
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill("להערכתי, " + fakeName + " צריכה להגיש את התצהיר עד יום ראשון.");
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("main")).toContainText("רונית לוי צריכה להגיש");
});
