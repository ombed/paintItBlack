const { test, expect } = require("./base");
const H = require("./helpers");

/* pdf-text.js had no behavioural test (review M11), and it sorted every line's text items
   by ascending x. A Hebrew line split into several items, which one bold word is enough to
   cause, came out with its items reversed: a name split across two items arrived backwards
   and was missed, with fewer findings and no error. The PDF here is printed by the browser
   from a page with a known reading order, and read back by the shipped extractor. */

const LINES = [
  ["העובדת הסוציאלית הגישה את הדוח היום", "העובדת הסוציאלית הגישה את הדוח היום"],
  ["האם <b>רונית לוי</b> מתגוררת בחיפה", "האם רונית לוי מתגוררת בחיפה"],
  ["הקטינה <b>נועה</b> בן-דוד ת.ז. 314277062 טלפון 052-6613874", "הקטינה נועה בן-דוד ת.ז. 314277062 טלפון 052-6613874"],
  ["The mother <b>Ronit Levy</b> lives in Haifa", "The mother Ronit Levy lives in Haifa"],
];

test("a Hebrew PDF is read in reading order, line by line, also when a line is split by formatting", async ({ page, context }) => {
  test.info().annotations.push({ type: "no-self-check" }); // no document is loaded into the app here
  const printer = await context.newPage();
  await printer.setContent(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;line-height:2.2;margin:40px">${LINES.map(([h]) => `<p style="margin:0 0 18px">${h}</p>`).join("")}</body></html>`);
  const pdf = await printer.pdf({ format: "A4" });
  await printer.close();

  await H.servePdfJsLocally(page);
  await page.goto("/index.html");
  const got = await page.evaluate(async (bytes) => {
    const { pdfToText } = await import("./pdf-text.js");
    return pdfToText(new Uint8Array(bytes).buffer);
  }, [...pdf]);
  expect(got.scanned).toBe(false);
  expect(got.pages).toBe(1);
  expect(got.text.split("\n").filter(Boolean)).toEqual(LINES.map(([, logical]) => logical));
});

/* Suspicion from the review, confirmed here: `scanned` was "fewer than 40 characters a page", so
   a scanned document whose pages each carry a printed court header came through as text, and
   she was never told that the body is a picture. A page counts as a picture when what is left
   after the lines repeated on most pages is under 40 characters. */
const HEADER = "בית המשפט לענייני משפחה בחיפה — תיק 12345-06-24";
const page_ = (body) => `<section style="page-break-after:always"><p style="margin:0 0 18px">${HEADER}</p>${body}</section>`;
const picture = `<div style="width:600px;height:700px;background:repeating-linear-gradient(45deg,#999 0 6px,#fff 6px 12px)"></div>`;
async function readPdf(page, context, html) {
  const printer = await context.newPage();
  await printer.setContent(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;margin:40px">${html}</body></html>`);
  const pdf = await printer.pdf({ format: "A4" });
  await printer.close();
  await H.servePdfJsLocally(page);
  await page.goto("/index.html");
  return page.evaluate(async (bytes) => { const { pdfToText } = await import("./pdf-text.js"); return pdfToText(new Uint8Array(bytes).buffer); }, [...pdf]);
}

test("a scanned PDF with a printed header on every page is still a scanned PDF", async ({ page, context }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const got = await readPdf(page, context, page_(picture) + page_(picture) + page_(picture));
  expect(got.pages).toBe(3);
  expect(got.scanned).toBe(true);
});

test("a PDF with some pages that are pictures says which", async ({ page, context }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const one = `<p>העובדת הסוציאלית הגישה את הדוח היום, והאם רונית לוי מסרה את גרסתה בפני הוועדה.</p>`;
  const three = `<p>הדיון נדחה לחודש הבא, והצדדים יגישו עד אז את עמדותיהם בכתב לבית המשפט.</p>`;
  const got = await readPdf(page, context, page_(one) + page_(picture) + page_(three));
  expect(got.scanned).toBe(false);
  expect(got.imagePages).toEqual([2]);
});

test("the app tells her which pages of the PDF are pictures", async ({ page, context }) => {
  test.info().annotations.push({ type: "no-self-check" }); // stops at the entry screen
  const one = `<p>העובדת הסוציאלית הגישה את הדוח היום, והאם רונית לוי מסרה את גרסתה בפני הוועדה.</p>`;
  const three = `<p>הדיון נדחה לחודש הבא, והצדדים יגישו עד אז את עמדותיהם בכתב לבית המשפט.</p>`;
  const printer = await context.newPage();
  await printer.setContent(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;margin:40px">${page_(one) + page_(picture) + page_(three)}</body></html>`);
  const pdf = await printer.pdf({ format: "A4" });
  await printer.close();
  await H.servePdfJsLocally(page);
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "case.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.locator("[data-notice]")).toContainText("עמוד 2 ב-PDF הוא תמונה");
});
