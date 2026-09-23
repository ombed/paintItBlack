/* A safety net that breaks must not read as a safety net that found nothing (outside review,
   M25, and the class it belongs to).

   The engine has three layers that look for what she did not list: the body scan (names in
   prose), the label scan (names alone in a chart or a SmartArt box) and the model, which reads
   the text in chunks. Each ran inside a catch that logged to the console and carried on. A
   body scan that threw left no suggestions, so the bar went green; a label scan likewise; and
   a model chunk that failed was skipped, so part of the document was never read by the model
   and nothing on the screen said so.

   Each layer is broken here on purpose, by appending to the engine, and the result must say
   which layer did not finish. The same class in the self-check (H4) is covered by
   e2e/base.js. */
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
fs.writeFileSync(path.join(HERE, "failopen-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) +
  "\nmodule.exports={redactDocx,nerRun,break:(k,f)=>{" +
  "if(k==='bodyNames')bodyNames=f;else if(k==='nameish')nameish=f;else if(k==='nerLoad')nerLoad=f;else if(k==='foldEvidence')foldEvidence=f;else throw new Error(k)}};\n");
const E = require("./failopen-core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const zipOf = (body, parts) => mkzip([...base, { name: "word/document.xml", body: doc(body) }, ...(parts || [])]);
const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, prefixes: "normal" };
const BODY = P(R("המורה רחל פרידמן אמרה שלום.")) + P(R("אחר כך רחל פרידמן הוסיפה."));
const boom = () => { throw new Error("broken on purpose"); };

(async () => {
  console.log("\n— every layer finishes on an ordinary document —");
  {
    const res = await E.redactDocx(zipOf(BODY), [], [], OPT);
    ok(Array.isArray(res.verification.incomplete) && res.verification.incomplete.length === 0,
      "nothing is reported unfinished: " + JSON.stringify(res.verification.incomplete));
  }

  console.log("\n— the body scan is switched off on purpose —");
  {
    const res = await E.redactDocx(zipOf(BODY), [], [], { ...OPT, body: false });
    ok((res.verification.incomplete || []).length === 0, "switching it off is not a failure: " + JSON.stringify(res.verification.incomplete));
  }

  const chart = { name: "word/charts/chart1.xml", body: '<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>קורמיץ שפלון</a:t></a:r></a:p></c:rich></c:tx></c:title></c:chart></c:chartSpace>' };

  console.log("\n— the body scan throws —");
  {
    E.break("bodyNames", boom);
    const res = await E.redactDocx(zipOf(BODY), [], [], OPT);
    const inc = res.verification.incomplete || [];
    ok(inc.includes("body"), "the result says the body scan did not finish: " + JSON.stringify(inc));
    ok(res.verification.complete === false, "and it is not reported complete");
  }

  console.log("\n— the label scan throws —");
  {
    E.break("nameish", boom);
    const res = await E.redactDocx(zipOf(BODY, [chart]), [], [], { ...OPT, body: false });
    const inc = res.verification.incomplete || [];
    ok(inc.includes("labels"), "the result says the label scan did not finish: " + JSON.stringify(inc));
    ok(res.verification.complete === false, "and it is not reported complete");
  }

  console.log("\n— more listed names than the spelling check reads —");
  {
    // review L12: findNear read the first 120 targets and dropped the rest without a word
    const L = "אבגדהוזחטיכלמנסעפצקרשת";
    const names = Array.from({ length: 130 }, (_, i) => "אב" + L[i % 22] + L[Math.floor(i / 22)] + "ון");
    const res = await E.redactDocx(zipOf(BODY), names.map((v) => ({ value: v, kind: "NAME" })), [], { ...OPT, near: true, body: false });
    const inc = res.verification.incomplete || [];
    ok(inc.includes("near"), "the result says the spelling check did not read every name: " + JSON.stringify(inc));
    ok(res.verification.nearOf && res.verification.nearOf.of === 130 && res.verification.nearOf.read === 120,
      "and how many it read: " + JSON.stringify(res.verification.nearOf));
    const few = await E.redactDocx(zipOf(BODY), names.slice(0, 20).map((v) => ({ value: v, kind: "NAME" })), [], { ...OPT, near: true, body: false });
    ok(!(few.verification.incomplete || []).includes("near"), "twenty names are all read");
  }

  console.log("\n— one chunk of the model fails —");
  {
    // a pipeline that answers every chunk but the second
    let calls = 0;
    const pipe = async () => { calls++; if (calls === 2) throw new Error("chunk broken on purpose"); return []; };
    E.break("nerLoad", async () => pipe);
    E.break("foldEvidence", async () => {});
    const long = Array.from({ length: 80 }, (_, i) => "שורה מספר " + i + " של הפרוטוקול, והדיון נמשך כרגיל בלי שמות.").join(" ");
    const blocks = [{ text: long }];
    let res, threw = null;
    try { res = await E.nerRun(blocks); } catch (e) { threw = e; }
    ok(!threw, "one broken chunk does not stop the model: " + (threw && threw.message));
    ok(calls >= 3, "the text is long enough to be read in several chunks: " + calls);
    ok(res && res.failedChunks === 1, "the result says how many chunks were not read: " + (res && res.failedChunks));
    ok(res && res.chunks === calls, "and out of how many: " + (res && res.chunks));
  }

  console.log("\n— every chunk of the model fails —");
  {
    E.break("nerLoad", async () => async () => { throw new Error("all broken on purpose"); });
    let threw = null;
    try { await E.nerRun([{ text: "המורה רחל פרידמן אמרה שלום." }]); } catch (e) { threw = e; }
    ok(!!threw, "a model that read nothing fails, so the screen shows the failure and not an empty list");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
