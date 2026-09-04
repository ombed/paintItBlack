/* טקסט מודבק (או טקסט שחולץ מ-PDF) → מסמך docx שלם, כדי שהמסלול הזה יעבור באותו
   מנוע בדיוק (זיהוי, השחרה, סריקת שיבושים ואימות) ולא בעותק חלקי שלו.
   החבילה כוללת styles / settings / docProps כי Word דורש אותן — בלעדיהן הוא
   פותח את הקובץ בהודעת «צריך שחזור». העימוד עברי: RTL, David 12, שורה וחצי. */
async function eng(){
  if(typeof window!=="undefined" && window.__RE) return window.__RE;
  return await import((typeof window!=="undefined" && window.__resources && window.__resources.engine) || "./redact-engine.js");
}

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const XD = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n`;
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// כותרת קטנה (שורה ראשונה של הטקסט אם היא קצרה) מקבלת הבלטה, השאר פסקאות גוף
const isHead = (line, i) => i===0 && line.length<=70 && !/[.,;:]$/.test(line);

function para(text, head){
  const pPr = `<w:pPr><w:bidi/>${head
    ? `<w:spacing w:before="0" w:after="240" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/>`
    : `<w:spacing w:before="0" w:after="160" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/>`}</w:pPr>`;
  const rPr = `<w:rPr><w:rtl/>${head?`<w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/>`:""}</w:rPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

const SECT = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`+
  `<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/>`+
  `<w:bidi/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;

const STYLES = XD+
  `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>`+
  `<w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David" w:eastAsia="David"/>`+
  `<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="he-IL" w:bidi="he-IL"/>`+
  `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/>`+
  `<w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`+
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>`+
  `<w:qFormat/><w:pPr><w:bidi/><w:jc w:val="both"/></w:pPr>`+
  `<w:rPr><w:rtl/></w:rPr></w:style>`+
  `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">`+
  `<w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>`+
  `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>`+
  `<w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>`+
  `<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/>`+
  `<w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style></w:styles>`;

const SETTINGS = XD+
  `<w:settings xmlns:w="${W}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/>`+
  `<w:characterSpacingControl w:val="doNotCompress"/>`+
  `<w:themeFontLang w:val="en-US" w:bidi="he-IL"/><w:compat/></w:settings>`;

const CT = XD+
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`+
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`+
  `<Default Extension="xml" ContentType="application/xml"/>`+
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`+
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`+
  `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>`+
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`+
  `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const RELS = XD+
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
  `<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>`+
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>`+
  `<Relationship Id="rId3" Type="${R}/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const DOCRELS = XD+
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
  `<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/>`+
  `<Relationship Id="rId2" Type="${R}/settings" Target="settings.xml"/></Relationships>`;

// בלי שם יוצר, בלי תאריכים אמיתיים — אותה מדיניות מטא-דאטה כמו בשאר הכלי
const CORE = XD+
  `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"`+
  ` xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"`+
  ` xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`+
  `<dc:title></dc:title><dc:creator></dc:creator><cp:lastModifiedBy></cp:lastModifiedBy>`+
  `<cp:revision>1</cp:revision>`+
  `<dcterms:created xsi:type="dcterms:W3CDTF">1970-01-01T00:00:00Z</dcterms:created>`+
  `<dcterms:modified xsi:type="dcterms:W3CDTF">1970-01-01T00:00:00Z</dcterms:modified></cp:coreProperties>`;

const APP = XD+
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"`+
  ` xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">`+
  `<Application></Application><Company></Company></Properties>`;

export async function textToDocx(text){
  const {zip, ENC} = await eng();
  const lines = String(text||"").replace(/\r\n/g,"\n").replace(/\u00a0/g," ").split("\n");
  let seen = 0, body = "";
  for(const raw of lines){
    const line = raw.trim();
    if(!line){ body += `<w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:p>`; continue; }
    body += para(line, isHead(line, seen));
    seen++;
  }
  const doc = XD+`<w:document xmlns:w="${W}"><w:body>${body}${SECT}</w:body></w:document>`;
  const blob = await zip([
    {name:"[Content_Types].xml", data:ENC.encode(CT)},
    {name:"_rels/.rels", data:ENC.encode(RELS)},
    {name:"word/document.xml", data:ENC.encode(doc)},
    {name:"word/_rels/document.xml.rels", data:ENC.encode(DOCRELS)},
    {name:"word/styles.xml", data:ENC.encode(STYLES)},
    {name:"word/settings.xml", data:ENC.encode(SETTINGS)},
    {name:"docProps/core.xml", data:ENC.encode(CORE)},
    {name:"docProps/app.xml", data:ENC.encode(APP)}
  ]);
  return blob.arrayBuffer();
}
