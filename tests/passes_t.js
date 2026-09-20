/* The engine's quiet passes (outside review, H6, H7, M18, M19).

   Each of these runs on every document and had no assertion at all: deleting any one of
   them left the whole suite green, and the app's own verification green with it. They are
   the passes that prevent the leaks nobody would see: a surname left alone after the full
   name was replaced, the client's email in a hyperlink target, a pseudonym written twice,
   comment markers pointing at a deleted part, and Word's per-machine revision marks. */
const xd = require("@xmldom/xmldom");
global.DOMParser = xd.DOMParser; global.XMLSerializer = xd.XMLSerializer;
{
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", { get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
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
fs.writeFileSync(path.join(HERE, "passes-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx,unzip};\n");
const E = require("./passes-core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base, TXT, WNS } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const zipOf = (body, parts) => mkzip([...base, { name: "word/document.xml", body: doc(body) }, ...(parts || [])]);
const partsOf = async (res) => Object.fromEntries((await E.unzip(await res.blob.arrayBuffer())).map((f) => [f.name, TXT.decode(f.data)]));
const text = (res) => res.preview.map((b) => b.text).join("\n");

(async () => {
  console.log("\n— a surname left alone after a name the engine found itself —");
  {
    // no list at all: the full name is found by its role anchor, and the bare surname two
    // paragraphs later must go with it. Every other test hands the name in through the list.
    const OPT = { on: new Set(["NAME_ANCHORED"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
    const res = await E.redactDocx(zipOf(P(R("התובעת: מרים אשכנזי הגישה את הבקשה.")) + P(R("הדיון נדחה.")) + P(R("אחר כך אשכנזי הוסיפה פרטים."))), [], [], OPT);
    const t = text(res);
    ok(!t.includes("מרים אשכנזי"), "the full name was found and replaced: " + t);
    ok(!t.includes("אשכנזי"), "the bare surname does not survive: " + t);
    ok(res.applied.some((r) => r.src === "sweep"), "and the record says the sweep did it");
  }

  console.log("\n— hyperlink targets that carry an address or a folder path —");
  {
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="mailto:rachel.friedman@example.com" TargetMode="External"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="file:///C:/Users/lawyer/Documents/%D7%AA%D7%99%D7%A7%20%D7%A4%D7%A8%D7%99%D7%93%D7%9E%D7%9F.docx" TargetMode="External"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.gov.il/he" TargetMode="External"/></Relationships>`;
    const res = await E.redactDocx(zipOf(P(R("ראו קישור.")), [{ name: "word/_rels/document.xml.rels", body: rels }]), [], [], { on: new Set(), flag: new Set(), mode: "real", near: false, body: false });
    const out = (await partsOf(res))["word/_rels/document.xml.rels"];
    ok(!/mailto:/.test(out) && !out.includes("rachel"), "a mailto target is neutralised");
    ok(!/file:/.test(out) && !out.includes("lawyer") && !out.includes("%D7%A4"), "a file target, with her folder and the case name, is neutralised");
    ok(out.includes("https://www.gov.il/he"), "an ordinary web link is left alone");
    ok(res.structural.rels.length === 2, "and both are counted for the report: " + res.structural.rels.length);
  }

  console.log("\n— a pseudonym that contains the value it replaces is written once —");
  {
    const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
    const res = await E.redactDocx(zipOf(P(R("המורה מרים אמרה שלום.")) + P(R("אחר כך מרים הוסיפה."))), [{ value: "מרים", kind: "NAME", replacement: "מרים אשכנזי" }], [], OPT);
    const t = text(res);
    ok(t.includes("המורה מרים אשכנזי אמרה") && t.includes("אחר כך מרים אשכנזי הוסיפה"), "replaced once in each place: " + t);
    ok(!/מרים מרים|אשכנזי אשכנזי/.test(t), "and never doubled: " + t);
  }

  console.log("\n— comment markers and revision marks are gone from the body —");
  {
    const body = `<w:p w:rsidR="00A11B22" w:rsidRDefault="00C33D44"><w:commentRangeStart w:id="0"/><w:r w:rsidRPr="00E55F66"><w:t>המורה אמרה.</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>`;
    const comments = `<?xml version="1.0"?><w:comments ${WNS}><w:comment w:id="0" w:author="x"><w:p><w:r><w:t>הערה</w:t></w:r></w:p></w:comment></w:comments>`;
    const res = await E.redactDocx(zipOf(body, [{ name: "word/comments.xml", body: comments }]), [], [], { on: new Set(), flag: new Set(), mode: "real", near: false, body: false });
    const parts = await partsOf(res), x = parts["word/document.xml"];
    ok(!("word/comments.xml" in parts), "the comments part is dropped");
    ok(!/commentRangeStart|commentRangeEnd|commentReference/.test(x), "no marker is left pointing at it");
    ok(res.structural.cm >= 3, "the markers are counted: " + res.structural.cm);
    ok(!/w:rsid/.test(x), "no revision-session mark is left: they link documents made on one machine");
    ok(res.structural.rsid >= 3, "and they are counted: " + res.structural.rsid);
    ok(x.includes("המורה אמרה."), "the text itself is untouched");
  }

  console.log("\n— the author of a tracked deletion goes with it —");
  {
    const body = P(R("המורה ") + `<w:del w:id="1" w:author="רחל פרידמן"><w:r><w:delText>אמרה</w:delText></w:r></w:del>` + R("הלכה."));
    const res = await E.redactDocx(zipOf(body), [], [], { on: new Set(), flag: new Set(), mode: "real", near: false, body: false });
    const x = (await partsOf(res))["word/document.xml"];
    ok(!/רחל|פרידמן/.test(x), "the author's name is not in the output");
    ok(!x.includes("אמרה"), "and the deleted text is gone");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
