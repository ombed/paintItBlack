const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* A transcript's own structure fills the people list. Every turn is a
   paragraph that opens "NAME: …", and the same speaker recurs. The anchor
   is deterministic, so this runs with the model stubbed to return nothing:
   what appears in the list came from the speaker turns alone. */

const TRANSCRIPT = [
  "תמלול דיון",
  "השופטת: אנחנו בדיון. מי מייצג?",
  'היו"ר אורלי לוי אבקסיס: אני מבקשת לפתוח.',
  "דליה לב שדה: תודה רבה ושלום לכולם.",
  "ענבר: אני רוצה להגיד משהו.",
  "שאלה: מה הסטטוס של התיק?",
  "דליה לב שדה: הסטטוס ידוע לכולם.",
  "ענבר: אני לא מסכימה.",
  'היו"ר אורלי לוי אבקסיס: תודה. הדיון נדחה.',
].join("\n");

test("speaker turns pre-fill the people list, labelled as speakers, with no model", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck(); // the model stays off entirely
  await H.upload(page, "hearing.docx", TRANSCRIPT);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });

  const names = await H.listedNames(page);
  // three-word speaker behind a title, three-word speaker, recurring one-word speaker
  expect(names).toContain("אורלי לוי אבקסיס");
  expect(names).toContain("דליה לב שדה");
  expect(names).toContain("ענבר");
  // a role label and a one-off non-name label are not people
  expect(names).not.toContain("השופטת");
  expect(names).not.toContain("שאלה");
  expect(names).toHaveLength(3);

  // the chip says where each came from
  const notes = await H.peopleRows(page).locator("small").allTextContents();
  expect(notes.filter((n) => n.includes("דובר בתמלול"))).toHaveLength(3);
  expect(await page.evaluate(() => window.__nerCalls || 0)).toBe(0);
});
