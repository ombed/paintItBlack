/* The Word structures a name can sit in (layer 1b of docs/QUALITY-PLAN.md). Shared by
   tests/structure_t.js, which runs the pipeline on each, and scripts/harvest-shapes.js,
   which checks that every structure seen in a real document is one of these (layer 4). */
const NS = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
].join(" ");
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const P = (inner) => `<w:p>${inner}</w:p>`;
const R = (t, rpr = "") => `<w:r>${rpr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const B = "<w:rPr><w:b/></w:rPr>";
const doc = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NS}><w:body>${P(R("פרוטוקול הדיון."))}${body}</w:body></w:document>`;
const part = (root, body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:${root} ${WNS}>${body}</w:${root}>`;
const base = [
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
];
const TXT = new TextDecoder();

// every structure: the body of document.xml, and any extra parts
const NAME = "רחל פרידמן";
const S = {
  "one plain run (control)": { body: P(R(`המורה ${NAME} אמרה.`)) },
  "split across two runs, bold then plain": { body: P(R("המורה ") + R("רחל ", B) + R("פרידמן") + R(" אמרה.")) },
  "split inside a word": { body: P(R("המורה רח") + R("ל פרידמן אמרה.", B)) },
  "a bookmark and a spell-check mark between the runs": { body: P(R("המורה רחל ") + '<w:proofErr w:type="spellStart"/><w:bookmarkStart w:id="0" w:name="_Ref1"/>' + R("פרידמן") + '<w:bookmarkEnd w:id="0"/><w:proofErr w:type="spellEnd"/>' + R(" אמרה.")) },
  "a tab between first and last name": { body: P(`<w:r><w:t>המורה רחל</w:t><w:tab/><w:t>פרידמן אמרה.</w:t></w:r>`) },
  "a line break between first and last name": { body: P(`<w:r><w:t>המורה רחל</w:t><w:br/><w:t>פרידמן אמרה.</w:t></w:r>`) },
  "a table cell": { body: `<w:tbl><w:tr><w:tc>${P(R("שם"))}</w:tc><w:tc>${P(R(NAME))}</w:tc></w:tr></w:tbl>` + P(R("")) },
  "a text box, with its VML fallback": {
    body: P(`<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="1" name="Text Box 1"/><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>${P(R(NAME))}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>${P(R(NAME))}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`),
  },
  "a hyperlink": { body: P(`<w:hyperlink w:anchor="x">${R(NAME)}</w:hyperlink>` + R(" אמרה.")) },
  "a field result": { body: P('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> REF _Ref1 \\h </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + R(NAME) + '<w:r><w:fldChar w:fldCharType="end"/></w:r>' + R(" אמרה.")) },
  "a simple field": { body: P(`<w:fldSimple w:instr=" DOCPROPERTY Client ">${R(NAME)}</w:fldSimple>` + R(" אמרה.")) },
  "a content control, with the name as its title": { body: `<w:sdt><w:sdtPr><w:alias w:val="${NAME}"/><w:tag w:val="${NAME}"/></w:sdtPr><w:sdtContent>${P(R(NAME))}</w:sdtContent></w:sdt>` },
  "an inline custom-XML wrapper": { body: P(`<w:customXml w:element="person">${R(NAME)}</w:customXml>` + R(" אמרה.")) },
  "a tracked insertion": { body: P(R("המורה ") + `<w:ins w:id="1" w:author="x">${R(NAME)}</w:ins>` + R(" אמרה.")) },
  "a tracked deletion": { body: P(R("המורה ") + `<w:del w:id="1" w:author="x"><w:r><w:delText>${NAME}</w:delText></w:r></w:del>` + R("אמרה.")) },
  "a tracked move": { body: P(`<w:moveFrom w:id="1" w:author="x">${R(NAME)}</w:moveFrom>`) + P(`<w:moveTo w:id="2" w:author="x">${R(NAME)}</w:moveTo>`) },
  "a tracked change whose author is the name": { body: P(R("המורה ") + `<w:ins w:id="1" w:author="${NAME}">${R("אמרה")}</w:ins>`) },
  "a comment": {
    body: P('<w:commentRangeStart w:id="0"/>' + R("המורה אמרה.") + '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>'),
    parts: [{ name: "word/comments.xml", body: part("comments", `<w:comment w:id="0" w:author="${NAME}">${P(R(`לבדוק עם ${NAME}`))}</w:comment>`) }],
  },
  "a header and a footer": {
    body: P(R("המורה אמרה.")),
    parts: [{ name: "word/header1.xml", body: part("hdr", P(R(`בעניין ${NAME}`))) }, { name: "word/footer1.xml", body: part("ftr", P(R(NAME))) }],
  },
  "a footnote and an endnote": {
    body: P(R("המורה אמרה.") + '<w:r><w:footnoteReference w:id="1"/></w:r>'),
    parts: [{ name: "word/footnotes.xml", body: part("footnotes", `<w:footnote w:id="1">${P(R(`כך אמרה ${NAME}.`))}</w:footnote>`) }, { name: "word/endnotes.xml", body: part("endnotes", `<w:endnote w:id="1">${P(R(NAME))}</w:endnote>`) }],
  },
  "a picture's alt text and title": { body: P(`<w:r><w:drawing><wp:inline><wp:docPr id="2" name="${NAME}" descr="${NAME} בבית המשפט" title="${NAME}"/></wp:inline></w:drawing></w:r>`) },
  "the file's own properties": {
    body: P(R("המורה אמרה.")),
    parts: [
      { name: "docProps/core.xml", body: `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>${NAME}</dc:creator><dc:title>תסקיר ${NAME}</dc:title></cp:coreProperties>` },
      { name: "docProps/app.xml", body: `<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>${NAME}</Company></Properties>` },
      { name: "docProps/custom.xml", body: `<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Client"><vt:lpwstr>${NAME}</vt:lpwstr></property></Properties>` },
    ],
  },
  "a document variable": {
    body: P(R("המורה אמרה.")),
    parts: [{ name: "word/settings.xml", body: part("settings", `<w:docVars><w:docVar w:name="client" w:val="${NAME}"/></w:docVars>`) }],
  },
  "a bookmark named after the person": { body: P(`<w:bookmarkStart w:id="3" w:name="${NAME.replace(" ", "_")}"/>` + R("המורה אמרה.") + '<w:bookmarkEnd w:id="3"/>') },
  "a SmartArt shape": {
    body: P(R("המורה אמרה.")),
    parts: [{ name: "word/diagrams/data1.xml", body: `<?xml version="1.0"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst><dgm:pt modelId="1"><dgm:t><a:p><a:r><a:t>${NAME}</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst></dgm:dataModel>` }],
  },
  "a chart label": {
    body: P(R("המורה אמרה.")),
    parts: [{ name: "word/charts/chart1.xml", body: `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>ביקורים של ${NAME}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:ser><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>${NAME}</c:v></c:pt></c:strCache></c:strRef></c:cat></c:ser></c:chart></c:chartSpace>` }],
  },
  "a formatting change whose author is the name": { body: P(`<w:r><w:rPr><w:b/><w:rPrChange w:id="5" w:author="${NAME}"><w:rPr/></w:rPrChange></w:rPr><w:t>המורה אמרה.</w:t></w:r>`) },
  // review H10: channels the engine did not walk at all
  "a field code": { body: P('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://example.org/' + NAME + '" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + R("קישור") + '<w:r><w:fldChar w:fldCharType="end"/></w:r>') },
  "a simple field's instruction": { body: P(`<w:fldSimple w:instr=' DOCPROPERTY "${NAME}" '>${R("ערך")}</w:fldSimple>`) },
  "a table's alt text": { body: `<w:tbl><w:tblPr><w:tblCaption w:val="${NAME}"/><w:tblDescription w:val="טבלת הביקורים של ${NAME}"/></w:tblPr><w:tr><w:tc>${P(R("שם"))}</w:tc></w:tr></w:tbl>` + P(R("")) },
  "a glossary building block": {
    body: P(R("המורה אמרה.")),
    parts: [{ name: "word/glossary/document.xml", body: doc(P(R(NAME))) }],
  },
};

module.exports = { NS, WNS, P, R, B, doc, part, base, TXT, NAME, S };
