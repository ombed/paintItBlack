/* Builds the Hebrew trial guide as a .docx she can open in Word:
     node scripts/build-guide.js ["out.docx"]

   Source is docs/trial-guide-he.md. Uses the same zip writer the corpus
   generator uses, so there is no new dependency.

   Right to left is set in four places, because Word needs all of them: the
   document defaults in styles.xml, w:bidi on every paragraph, w:rtl on every
   run, and w:bidi in the section properties. Miss one and Hebrew paragraphs
   come out left aligned with the punctuation in the wrong place.

   Markdown understood here: # title, ## section, ### step, - bullet,
   1. numbered, **bold**, and "> " for a callout box ("> ! " for a warning). */
const fs = require("fs");
const path = require("path");
const REPO = path.join(__dirname, "..");
const { mkzip } = require(path.join(REPO, "tests", "mkzip.js"));

const INK = "16211C", ACCENT = "1F5B44", WARN = "9C5511";
const PANEL = "EFF4F1", WARNBG = "FBF2E4";
const FONT = "Arial";

// node scripts/build-guide.js [source.md] [out.docx] — the trial guide by default
const SRC = process.argv[2] && /\.md$/.test(process.argv[2]) ? path.resolve(process.argv[2]) : path.join(REPO, "docs", "trial-guide-he.md");
const md = fs.readFileSync(SRC, "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// ── parse ────────────────────────────────────────────────────────────────────
const paras = [];
for (const raw of md.split(/\r?\n/)) {
  const line = raw.replace(/\s+$/, "");
  if (!line.trim()) { paras.push(["", "gap"]); continue; }
  let m;
  if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { paras.push([m[2], "h" + m[1].length]); continue; }
  if ((m = /^>\s*!\s*(.*)$/.exec(line))) { paras.push([m[1], "warn"]); continue; }
  if ((m = /^>\s*(.*)$/.exec(line))) { paras.push([m[1], "note"]); continue; }
  if ((m = /^[-*]\s+(.*)$/.exec(line))) { paras.push([m[1], "li"]); continue; }
  if ((m = /^(\d+)\.\s+(.*)$/.exec(line))) { paras.push([m[1] + ". " + m[2], "num"]); continue; }
  // a soft wrap continues the paragraph above it
  const last = paras[paras.length - 1];
  if (last && last[0] && ["body", "li", "num", "note", "warn"].includes(last[1])) { last[0] += " " + line.trim(); continue; }
  paras.push([line.trim(), "body"]);
}

// ── render ───────────────────────────────────────────────────────────────────
function runs(text, base) {
  const out = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const t = bold ? part.slice(2, -2) : part;
    out.push(`<w:r><w:rPr>${base}${bold ? "<w:b/>" : ""}<w:rtl/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
  }
  return out.join("") || `<w:r><w:rPr>${base}<w:rtl/></w:rPr><w:t xml:space="preserve"></w:t></w:r>`;
}
const rpr = (sz, color, bold) => `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>` +
  `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="${color}"/>${bold ? "<w:b/>" : ""}`;

const KIND = {
  h1:   { sz: 40, color: ACCENT, bold: 1, before: 0,   after: 60,  border: 0 },
  h2:   { sz: 28, color: ACCENT, bold: 1, before: 360, after: 120, border: 1 },
  h3:   { sz: 24, color: INK,    bold: 1, before: 260, after: 100, border: 0 },
  body: { sz: 22, color: INK,    bold: 0, before: 0,   after: 140, border: 0 },
  li:   { sz: 22, color: INK,    bold: 0, before: 0,   after: 90,  border: 0, ind: 1, bullet: 1 },
  num:  { sz: 22, color: INK,    bold: 0, before: 0,   after: 120, border: 0, ind: 1 },
  note: { sz: 22, color: INK,    bold: 0, before: 120, after: 160, border: 0, box: PANEL, bar: ACCENT },
  warn: { sz: 22, color: INK,    bold: 0, before: 120, after: 160, border: 0, box: WARNBG, bar: WARN },
  gap:  { sz: 12, color: INK,    bold: 0, before: 0,   after: 0,   border: 0 },
};

const body = paras.map(([text, kind]) => {
  const k = KIND[kind] || KIND.body;
  const pieces = [];
  pieces.push("<w:bidi/>", '<w:jc w:val="both"/>');
  pieces.push(`<w:spacing w:before="${k.before}" w:after="${k.after}" w:line="288" w:lineRule="auto"/>`);
  if (k.ind) pieces.push('<w:ind w:right="340"/>');
  if (k.box) {
    // the coloured bar sits on the right, which is the leading edge here
    pieces.push(`<w:pBdr><w:right w:val="single" w:sz="18" w:space="8" w:color="${k.bar}"/></w:pBdr>`);
    pieces.push(`<w:shd w:val="clear" w:fill="${k.box}"/>`);
    pieces.push('<w:ind w:right="170" w:left="170"/>');
  }
  if (k.border) pieces.push(`<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="CBD8D0"/></w:pBdr>`);
  const base = rpr(k.sz, k.color, k.bold);
  pieces.push(`<w:rPr>${base}<w:rtl/></w:rPr>`);
  const lead = k.bullet ? `<w:r><w:rPr>${rpr(k.sz, ACCENT, 1)}<w:rtl/></w:rPr><w:t xml:space="preserve">• </w:t></w:r>` : "";
  return `<w:p><w:pPr>${pieces.join("")}</w:pPr>${lead}${runs(text, base)}</w:p>`;
}).join("");

const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ' + W + "><w:body>" + body +
  '<w:sectPr><w:bidi/><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1240" w:right="1300" w:bottom="1240" w:left="1300"/></w:sectPr></w:body></w:document>';

const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:styles ' + W + ">" +
  "<w:docDefaults><w:rPrDefault><w:rPr>" +
  `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>` +
  `<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="${INK}"/><w:rtl/>` +
  "</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/>" +
  '<w:spacing w:after="140" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
  '<w:pPr><w:bidi/></w:pPr><w:rPr><w:rtl/></w:rPr></w:style></w:styles>';

const settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:settings ' + W +
  '><w:themeFontLang w:val="en-US" w:bidi="he-IL"/></w:settings>';

const buf = mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
  { name: "word/_rels/document.xml.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>' },
  { name: "word/document.xml", body: doc },
  { name: "word/styles.xml", body: styles },
  { name: "word/settings.xml", body: settings },
]);
const outArg = process.argv.slice(2).find((a) => /\.docx$/.test(a));
const out = outArg || SRC.replace(/\.md$/, ".docx");
fs.writeFileSync(out, Buffer.from(buf));
console.log("wrote " + out + " (" + paras.filter((p) => p[0]).length + " paragraphs)");
