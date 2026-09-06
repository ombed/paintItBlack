/* Loads redact-engine.js into Node with its full export list, plus the
   browser shims the engine expects. Same approach as tests/build-fixtures.js,
   but exporting everything the module exports rather than the suites' list,
   because the benchmark drives the whole chain: discover, redactDocx,
   verification, and the model-output cleaning.

   require("./engine.js") is the shipped engine. require("./engine.js").load(patches)
   is the same engine with textual patches applied, each [from, to] required to
   match exactly once; sweep.js uses it to score a parameter at several values
   without editing the source. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const xd = require("@xmldom/xmldom");

global.DOMParser = xd.DOMParser;
global.XMLSerializer = xd.XMLSerializer;
{ // xmldom lacks children/querySelector; the engine uses both
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", {
      get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
    if (!proto.querySelector) proto.querySelector = function (t) {
      const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
    // xmldom has no Element.remove(); the engine uses it in stripComments
    if (!proto.remove) proto.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
  }
}
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const SRC = path.join(__dirname, "..", "redact-engine.js");
// Internal helpers the benchmark needs that the module does not export:
// nerAlign and nerGroup mirror nerRun's per-chunk steps; KNOWN_FIRST is the
// union the generator must stay disjoint from; the rest feed the reports.
const EXTRA = ["nerAlign", "nerGroup", "KNOWN_FIRST", "COMMON", "VRB", "GF", "GM", "WORDLIKE", "STOP", "HOMO", "WEAK", "cleanName", "anchorOK", "trimEdges", "anchored"];

function build(patches, outName) {
  // LF throughout, so a multi-line patch matches whatever the checkout's line endings are
  let src = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n")
    .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
    .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
  for (const [from, to] of patches || []) {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`patch matches ${n} times, need exactly 1: ${from.slice(0, 60)}`);
    src = src.replace(from, () => to);
  }
  const exportBlock = (src.match(/^export\s*\{([\s\S]*?)\};?[ \t]*$/m) || [])[1];
  if (!exportBlock) throw new Error("no export block in redact-engine.js");
  const names = exportBlock.split(",").map((s) => s.trim()).filter(Boolean);
  for (const extra of EXTRA) if (!names.includes(extra)) names.push(extra);
  src = src.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, "");
  src = src.replace(/^export\s*\{[\s\S]*?\};?[ \t]*$/gm, "");
  const OUT = path.join(__dirname, outName);
  fs.writeFileSync(OUT, src + "\nmodule.exports={" + names.join(",") + "};\n");
  delete require.cache[require.resolve(OUT)];
  const mod = require(OUT);
  if (outName !== ".engine.cjs") fs.unlinkSync(OUT);
  return mod;
}

const E = build([], ".engine.cjs");
E.load = (patches) => build(patches, ".engine-" + crypto.createHash("md5").update(JSON.stringify(patches)).digest("hex").slice(0, 8) + ".cjs");
module.exports = E;
