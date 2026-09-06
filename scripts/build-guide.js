/* Builds the Hebrew trial guide as a .docx she can open in Word:
     node scripts/build-guide.js ["out.docx"]

   Source is docs/trial-guide-he.md. Uses the same zip writer the corpus
   generator uses, so there is no new dependency, and writes a right-to-left
   document: every paragraph carries w:bidi and every run w:rtl, or Word lays
   the Hebrew out left to right. Markdown soft wraps are joined, so a sentence
   broken across source lines is one paragraph in Word. */
const fs = require("fs");
const path = require("path");
const REPO = path.join(__dirname, "..");
const { mkzip } = require(path.join(REPO, "tests", "mkzip.js"));

const md = fs.readFileSync(path.join(REPO, "docs", "trial-guide-he.md"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const paras = [];
for (const raw of md.split(/\r?\n/)) {
  const line = raw.replace(/\s+$/, "");
  if (/^---+$/.test(line)) { paras.push(["", "sep"]); continue; }
  if (!line.trim()) { paras.push(["", "body"]); continue; }
  let m;
  if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { paras.push([m[2], "h" + m[1].length]); continue; }
  if ((m = /^[-*]\s+(.*)$/.exec(line))) { paras.push([m[1], "li"]); continue; }
  if ((m = /^(\d+)\.\s+(.*)$/.exec(line))) { paras.push([m[1] + ". " + m[2], "li"]); continue; }
  // an indented continuation belongs to the list item above it
  if (/^\s{2,}/.test(raw) && paras.length && paras[paras.length - 1][1] === "li") {
    paras[paras.length - 1][0] += " " + line.trim(); continue;
  }
  const last = paras[paras.length - 1];
  if (last && last[1] === "body" && last[0]) last[0] += " " + line.trim();
  else paras.push([line.trim(), "body"]);
}

// bold runs come from **...**, everything else is plain
function runs(text) {
  const out = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const t = bold ? part.slice(2, -2) : part;
    out.push(`<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:rtl/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
  }
  return out.join("") || '<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve"></w:t></w:r>';
}
const SIZE = { h1: 36, h2: 28, h3: 24, body: 22, li: 22, sep: 22 };
const body = paras.map(([t, kind]) => {
  const sz = SIZE[kind] || 22;
  const ind = kind === "li" ? '<w:ind w:right="360"/>' : "";
  const space = kind.startsWith("h") ? '<w:spacing w:before="240" w:after="120"/>' : '<w:spacing w:after="120"/>';
  const bdr = kind === "sep" ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:color="BBBBBB"/></w:pBdr>' : "";
  const rpr = `<w:rPr><w:rtl/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${kind.startsWith("h") ? "<w:b/>" : ""}</w:rPr>`;
  return `<w:p><w:pPr><w:bidi/><w:jc w:val="right"/>${space}${ind}${bdr}${rpr}</w:pPr>${runs(t)}</w:p>`;
}).join("");

const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ' + W +
  "><w:body>" + body + '<w:sectPr><w:bidi/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';

const buf = mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
  { name: "word/_rels/document.xml.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: doc },
]);
const out = process.argv[2] || path.join(REPO, "docs", "trial-guide-he.docx");
fs.writeFileSync(out, Buffer.from(buf));
console.log("wrote " + out + " (" + paras.filter((p) => p[0]).length + " paragraphs)");
