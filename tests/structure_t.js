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
fs.writeFileSync(path.join(HERE, "structure-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx,unzip,verify,readBlocks};\n");
const E = require("./structure-core.js");
const { mkzip } = require("./mkzip.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const { P, R, doc, base, TXT, NAME, S } = require("./structure-lib.js");

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

  /* Review C2. Every case above supplies the rule itself, so it proves the apply layer and
     says nothing about who would have proposed the name. These run with an empty list, the
     way a document arrives: the name must either be gone from the file, or be put in front
     of her, and the result must not be reported as complete. */
  console.log("\n— with nothing on her list: gone from the file, or put in front of her —");
  {
    const chartOf = (label) => `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:ser><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>${label}</c:v></c:pt></c:strCache></c:strRef></c:cat></c:ser></c:chart></c:chartSpace>`;
    const smart = (label) => `<?xml version="1.0"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst><dgm:pt modelId="1"><dgm:t><a:p><a:r><a:t>${label}</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst></dgm:dataModel>`;
    const chartEx = (label) => `<?xml version="1.0"?><cx:chartSpace xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"><cx:chartData><cx:data id="0"><cx:strDim type="cat"><cx:lvl ptCount="1"><cx:pt idx="0">${label}</cx:pt></cx:lvl></cx:strDim></cx:data></cx:chartData></cx:chartSpace>`;
    const plain = P(R("המסמך עוסק בהסדרי ראייה ובמזונות."));
    const NOLIST = { ...OPT, body: true };
    for (const [what, parts] of [
      ["a chart label", [{ name: "word/charts/chart1.xml", body: chartOf(NAME) }]],
      ["an extended chart label", [{ name: "word/charts/chartEx1.xml", body: chartEx(NAME) }]],
      ["a SmartArt shape", [{ name: "word/diagrams/data1.xml", body: smart(NAME) }]],
    ]) {
      const blocks = await E.readBlocks(zipOf(plain, parts));
      ok(blocks.some((b) => b.text.includes(NAME)), `${what}: the proposal layers can read it`);
      const res = await E.redactDocx(zipOf(plain, parts), [], [], NOLIST);
      ok(res.verification.suggest.some((x) => x.value === NAME), `${what}: proposed to her: ${JSON.stringify(res.verification.suggest.map((x) => x.value))}`);
      ok(res.verification.complete === false, `${what}: not reported as complete`);
    }
    // invisible machine data is removed, whatever it holds
    const hiddenCases = [
      ["a document variable", plain, S["a document variable"].parts],
      ["a content control's title and tag", S["a content control, with the name as its title"].body.replace(`<w:sdtContent>${P(R(NAME))}</w:sdtContent>`, `<w:sdtContent>${P(R("טקסט"))}</w:sdtContent>`), []],
    ];
    for (const [what, body, parts] of hiddenCases) {
      const res = await E.redactDocx(zipOf(body, parts), [], [], NOLIST);
      const out = await outOf(res);
      const left = out.filter((f) => /\.xml$/.test(f.name) && /רחל|פרידמן/.test(TXT.decode(f.data))).map((f) => f.name);
      ok(!left.length, `${what}: gone from the file with nothing on the list, still in ${left.join(", ")}`);
      ok(res.structural.hidden > 0, `${what}: counted among what was cleaned`);
      ok(!(await E.readBlocks(zipOf(body, parts))).some((b) => b.text.includes(NAME)), `${what}: not offered as text either, so it cannot become a rule that finds nothing`);
    }
    // ordinary chart labels are left alone
    const labels = ["הכנסות", "ינואר", "רבעון ראשון", "סדרה 1", "סך הכול", "ביקורים בחודש"];
    const quiet = await E.redactDocx(zipOf(plain, labels.map((l, i) => ({ name: `word/charts/chart${i + 1}.xml`, body: chartOf(l) }))), [], [], NOLIST);
    ok(quiet.verification.suggest.length === 0, "ordinary labels are not proposed: " + JSON.stringify(quiet.verification.suggest.map((x) => x.value)));
    // a label that is already on her list is not proposed again
    const listed = await E.redactDocx(zipOf(plain, [{ name: "word/charts/chart1.xml", body: chartOf(NAME) }]), SUBS, [], NOLIST);
    ok(!listed.verification.suggest.some((x) => x.value === NAME), "a listed name is replaced, not proposed");
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
