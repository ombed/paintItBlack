/* Loads redact-engine.js into Node with its full export list, plus the
   browser shims the engine expects. Same approach as tests/build-fixtures.js,
   but exporting everything the module exports rather than the suites' list,
   because the benchmark drives the whole chain: discover, redactDocx,
   verification, and the model-output cleaning. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
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
  }
}
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const SRC = path.join(__dirname, "..", "redact-engine.js");
let src = fs.readFileSync(SRC, "utf8")
  .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
  .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
const exportBlock = (src.match(/^export\s*\{([\s\S]*?)\};?[ \t]*$/m) || [])[1];
if (!exportBlock) throw new Error("no export block in redact-engine.js");
const names = exportBlock.split(",").map((s) => s.trim()).filter(Boolean);
// Internal helpers the benchmark needs that the module does not export:
// nerAlign and nerGroup mirror nerRun's per-chunk steps; KNOWN_FIRST is the
// union the generator must stay disjoint from; the rest feed the reports.
for (const extra of ["nerAlign", "nerGroup", "KNOWN_FIRST", "COMMON", "VRB", "GF", "GM"])
  if (!names.includes(extra)) names.push(extra);
src = src.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, "");
src = src.replace(/^export\s*\{[\s\S]*?\};?[ \t]*$/gm, "");
const OUT = path.join(__dirname, ".engine.cjs");
fs.writeFileSync(OUT, src + "\nmodule.exports={" + names.join(",") + "};\n");
module.exports = require(OUT);
