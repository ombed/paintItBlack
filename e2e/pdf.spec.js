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
