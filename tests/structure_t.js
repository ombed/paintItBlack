/* Word structure (docs/QUALITY-PLAN.md, layer 1b).

   The shape suite writes a value in every typographic shape inside one plain
   run. Real Word files put the same name in places a plain run never is: split
   across two runs with different formatting, with a bookmark or a spell-check
   mark between them, in a table, a text box, a hyperlink, a field, a content
   control, a tracked change, a comment, a header, a footnote, the alt text of
   a picture, the file's properties, a document variable, a bookmark's own
   name, a SmartArt shape or a chart.

   Each case builds a real .docx with "רחל פרידמן" in one structure, runs the
   whole pipeline, and then reads every XML part of the output. No piece of the
   name may survive anywhere, visible or not: the file is what leaves. A new
   structure seen in a real file is one more case here. */
const xd = require("@xmldom/xmldom");
global.DOMParser = xd.DOMParser; global.XMLSerializer = xd.XMLSerializer;
{
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", { get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
    // browsers have Element.remove(); xmldom does not, and the pipeline uses it
    if (!proto.remove) proto.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
    if (!proto.querySelector) proto.querySelector = function (t) { const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
  }
}
const zlib = require("zlib"), fs = require("fs"), path = require("path");
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const HERE = __dirname;
const js = fs.readFileSync(path.join(HERE, "app.html"), "utf8").split("<script>")[1].split("</script>")[0]
  .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
  .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
const cut = js.indexOf("/* ══════════════════════════ ממשק ══════════════════════════ */");
const a = js.indexOf("function pseudoRX(p){"), b = js.indexOf("function livePairs(){");
fs.writeFileSync(path.join(HERE, "structure-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx,unzip,verify};\n");
const E = require("./structure-core.js");
const { mkzip } = require("./mkzip.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

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
  "a glossary building block": {
    body: P(R("המורה אמרה.")),
    parts: [{ name: "word/glossary/document.xml", body: doc(P(R(NAME))) }],
  },
};

const OPT = { on: new Set(["PLACES"]), flag: new Set(), mode: "real", near: false, prefixes: "normal" };
const SUBS = [{ value: NAME, kind: "NAME", replacement: "יעל כהן" }];
const zipOf = (body, parts) => mkzip([...base, { name: "word/document.xml", body: doc(body) }, ...(parts || [])]);
const outOf = async (res) => E.unzip(await res.blob.arrayBuffer());
const docXml = (out) => TXT.decode(out.find((f) => f.name === "word/document.xml").data);
const bodyOf = (x) => (x.match(/<w:body>[\s\S]*<\/w:body>/) || [""])[0];

(async () => {
  console.log(`\n— ${NAME} in every Word structure: no piece of it in any part of the output —`);
  for (const [name, c] of Object.entries(S)) {
    const zip = mkzip([...base, { name: "word/document.xml", body: doc(c.body) }, ...(c.parts || [])]);
    let res;
    try { res = await E.redactDocx(zip, SUBS, [], OPT); } catch (e) { ok(false, `${name}: the pipeline threw: ${e.message}`); continue; }
    const out = await E.unzip(await res.blob.arrayBuffer());
    const left = out.filter((f) => /\.(xml|rels)$/.test(f.name)).filter((f) => { const t = TXT.decode(f.data); return t.includes("רחל") || t.includes("פרידמן"); }).map((f) => f.name);
    ok(!left.length, `${name}: the name is still in ${left.join(", ")}`);
    const docOut = TXT.decode(out.find((f) => f.name === "word/document.xml").data);
    ok(/<w:body>/.test(docOut) && docOut.includes("פרוטוקול הדיון"), `${name}: the document body did not survive`);
  }

  console.log("\n— a hyphen or a soft hyphen that Word stores as an element —");
  {
    const subs = [{ value: "אורי בן-שחר", kind: "NAME", replacement: "יובל שמיר" }];
    let out = await outOf(await E.redactDocx(zipOf(P("<w:r><w:t>המורה אורי בן</w:t><w:noBreakHyphen/><w:t>שחר אמר.</w:t></w:r>")), subs, [], OPT));
    ok(!/אורי|שחר/.test(docXml(out)), "a non-breaking hyphen inside the surname: " + bodyOf(docXml(out)));
    out = await outOf(await E.redactDocx(zipOf(P("<w:r><w:t>המורה רחל פרי</w:t><w:softHyphen/><w:t>דמן אמרה.</w:t></w:r>")), SUBS, [], OPT));
    ok(!/רחל|פרידמן|פרי<|דמן/.test(docXml(out)), "a soft hyphen inside the surname: " + bodyOf(docXml(out)));
  }

  console.log("\n— a tab stop defined on the paragraph is not a space in the text —");
  {
    const res = await E.redactDocx(zipOf(P('<w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>' + R("המורה " + NAME + " אמרה."))), SUBS, [], OPT);
    const t = res.preview.map((b) => b.text).join("\n");
    ok(t.includes("המורה יעל כהן אמרה.") && !t.includes("  "), "the paragraph reads as written: " + JSON.stringify(t));
  }

  console.log("\n— a renamed bookmark keeps its links —");
  {
    const bm = NAME.replace(" ", "_");
    const body = P(`<w:bookmarkStart w:id="4" w:name="${bm}"/>` + R("המורה אמרה.") + '<w:bookmarkEnd w:id="4"/>') +
      P(`<w:hyperlink w:anchor="${bm}">` + R("לעיל") + "</w:hyperlink>") +
      P(`<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGEREF ${bm} \\h </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>` + R("3") + '<w:r><w:fldChar w:fldCharType="end"/></w:r>');
    const x = docXml(await outOf(await E.redactDocx(zipOf(body), SUBS, [], OPT)));
    const nm = (x.match(/bookmarkStart w:id="4" w:name="([^"]+)"/) || [])[1];
    ok(nm && !/[א-ת]/.test(nm), "the bookmark has a neutral name: " + nm);
    ok(x.includes(`w:anchor="${nm}"`), "the internal link points to it");
    ok(x.includes(`PAGEREF ${nm} `), "the page reference points to it");
  }

  console.log("\n— the last check reads names split by runs, tabs and underscores —");
  {
    for (const [label, body] of [
      ["split across runs", P(R("רחל ") + R("פרידמן"))],
      ["a tab between", P("<w:r><w:t>רחל</w:t><w:tab/><w:t>פרידמן</w:t></w:r>")],
      ["a bookmark name", P('<w:bookmarkStart w:id="1" w:name="רחל_פרידמן"/>')],
    ]) {
      const v = await E.verify(zipOf(body), [NAME]);
      ok(!v.passed && v.leaks.some((l) => l.part === "word/document.xml"), label + ": the leak is reported");
    }
    const clean = await E.verify(zipOf(P(R("רחל")) + P(R("פרידמן"))), [NAME]);
    ok(clean.passed, "two paragraphs, one word each, are not joined into the name: " + JSON.stringify(clean.leaks));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
