/* A pseudonym she types that is another real person in the document is not replaced again
   (QA round 1, M1). Invented names only. */
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
fs.writeFileSync(path.join(HERE, "chain-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx,unzip};\n");
const E = require("./chain-core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base, TXT, WNS } = require("./structure-lib.js");


let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const zipOf = (body) => mkzip([...base, { name: "word/document.xml", body: doc(body) }]);
const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };

(async () => {
  const body = P(R("הקטינה נועה גלבוע מסרה את גרסתה.")) + P(R("הפסיכולוגית יעל אורן-כץ נפגשה איתה.")) + P(R("גלבוע סיפרה על הבית.")) + P(R("אורן-כץ המליצה על ליווי."));
  const subs = [{ value: "נועה גלבוע", kind: "NAME", replacement: "יעל אורן-כץ" }, { value: "יעל אורן-כץ", kind: "NAME" }];
  const res = await E.redactDocx(zipOf(body), subs, [], OPT);
  const lines = res.preview.map((b) => b.text);
  console.log("   " + lines.join(" | "));
  const noa = lines.find((l) => l.startsWith("הקטינה")), psy = lines.find((l) => l.startsWith("הפסיכולוגית"));
  ok(noa && noa.includes("הקטינה יעל אורן-כץ מסרה"), "her typed pseudonym stands, written once: " + noa);
  ok(psy && !psy.includes("יעל אורן-כץ"), "the psychologist herself is replaced: " + psy);
  const psyRep = (res.applied.find((r) => (r.base || r.value) === "יעל אורן-כץ") || {}).rep || "";
  ok(!noa.includes(psyRep.split(" ")[0]) || !psyRep, "and her pseudonym is not then replaced as if it were the psychologist: " + noa);
})().then(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; });
