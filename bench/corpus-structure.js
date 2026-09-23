/* Three documents whose names sit outside the body text (outside review, M20).

   Every other corpus document is a three-part zip with the whole text in document.xml, and
   the leak check read the flattened body, so the tool's promise about the rest of a Word
   file — headers, notes, comments, properties, alt text — was measured nowhere. Here each
   channel carries a person who appears in that channel only:

     S_HEADER    the header of every page ("בעניין הקטין ...")
     S_FOOTNOTE  a footnote
     S_ALT       a picture's alt text, which Word's accessibility checker asks for
     S_COMMENT   a comment and its author; the comments part is removed from the file
     S_META      the file's properties (author, title); they are emptied

   The last two are removed wholesale by design, so nothing proposes them: for those, a
   name gone from the output file counts as handled (via "removed"), and one left in it as
   a leak. Invented text and invented people. */
module.exports = function structure(Doc, C) {
  const docs = [];
  Object.assign(C, {
    S_HEADER: "channel: person only in the page header",
    S_FOOTNOTE: "channel: person only in a footnote",
    S_ALT: "channel: person only in a picture's alt text",
    S_COMMENT: "channel: person only in a comment and as its author (removed by design)",
    S_META: "channel: person only in the file's properties (emptied by design)",
  });
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const para = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  const part = (root, inner) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:${root} ${W}>${inner}</w:${root}>`;

  const PEOPLE = [
    // header, footnote, alt, comment, meta
    ["אלישבע קרמרמן", "רפאל דנגורי", "שולמית אוזרבך", "נתנאל פרוכטר", "פרומה גלעדיאן"],
    ["גיטל שפטלוביץ", "ברוריה מלמדוב", "צביקה גוטרמן", "שפרינצה פייגנבוים", "זלדה רוזנקרנץ"],
    ["רייזל קוסטיוקוב", "מנחם זילברמינץ", "טויבה טרכטנברג", "שמשון ברקוביצ'ר", "בלומה אופנהיים"],
  ];
  PEOPLE.forEach(([h, fn, alt, cm, meta], i) => {
    const d = new Doc("s" + (i + 1), "structure", "תסקיר עם כותרת, הערות ומאפייני קובץ");
    d.ent("S_HEADER", "NAME", true, h, [h]);
    d.ent("S_FOOTNOTE", "NAME", true, fn, [fn]);
    d.ent("S_ALT", "NAME", true, alt, [alt]);
    d.ent("S_COMMENT", "NAME", true, cm, [cm]);
    d.ent("S_META", "NAME", true, meta, [meta]);
    d.ent("O_PUBLIC", "ORG", false, "משרד הרווחה", ["משרד הרווחה"]);
    d.p("תסקיר סוציאלי בעניין הסדרי שהות.")
     .p("הקטין מתגורר עם אמו, ולומד בכיתה ד. הוא מגיע לבית הספר באופן סדיר, ומתפקד היטב מבחינה לימודית.")
     .p("במהלך התקופה נפגשנו עם שני ההורים, ועם הצוות החינוכי, ובדקנו את המלצות משרד הרווחה.")
     .p("הקטין סיפר שהוא נהנה מהביקורים אצל אביו, ושהוא מבקש שיימשכו גם בחופשות.");
    d.raw(`<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:docPr id="${i + 1}" name="תמונה ${i + 1}" descr="${esc(alt)} בפגישה במרכז הקשר"/></wp:inline></w:drawing></w:r></w:p>`, alt + " בפגישה במרכז הקשר");
    d.raw(`<w:p><w:r><w:t xml:space="preserve">המלצת הצוות מפורטת להלן.</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:commentRangeStart w:id="0"/><w:r><w:t xml:space="preserve"> ההמלצה סופית.</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>`, "המלצת הצוות מפורטת להלן. ההמלצה סופית.");
    d.part("word/header1.xml", part("hdr", para(`בעניין הקטין — תסקיר שהוגש לבקשת ${h}`)), `בעניין הקטין — תסקיר שהוגש לבקשת ${h}`);
    d.part("word/footnotes.xml", part("footnotes", `<w:footnote w:id="1">${para(`על פי שיחה עם ${fn} מהצוות החינוכי.`)}</w:footnote>`), `על פי שיחה עם ${fn} מהצוות החינוכי.`);
    d.part("word/comments.xml", part("comments", `<w:comment w:id="0" w:author="${esc(cm)}">${para(`לבדוק עם ${cm} לפני ההגשה`)}</w:comment>`), `לבדוק עם ${cm} לפני ההגשה`);
    d.part("docProps/core.xml", `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>${esc(meta)}</dc:creator><dc:title>תסקיר — ${esc(meta)}</dc:title></cp:coreProperties>`, `${meta} תסקיר — ${meta}`);
    docs.push(d);
  });
  return docs;
};
