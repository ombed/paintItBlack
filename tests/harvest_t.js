/* The shape harvester (scripts/harvest-shapes.js, docs/QUALITY-PLAN.md layer 4).

   It runs on private documents that CI never sees, so its own correctness is
   checked here on synthetic ones: each structure must come out as the shape it
   is, and the report must refuse to carry text. A harvester that silently finds
   nothing would report "every shape covered" forever; the first run of this one
   did exactly that, because the XML parser rejected its options. */
const H = require("../scripts/harvest-shapes.js");
const L = require("./structure-lib.js");
const { mkzip } = require("./mkzip.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const shapesOf = (body, parts, surfaces = [L.NAME]) => H.harvest(H.unzip(Buffer.from(mkzip([...L.base, { name: "word/document.xml", body: L.doc(body) }, ...(parts || [])]))), surfaces);
const one = (body, parts) => shapesOf(body, parts).filter((s) => !s.attr && !s.element)[0] || {};

console.log("\n— each structure comes out as the shape it is —");
{
  const plain = one(L.S["one plain run (control)"].body);
  ok(plain.part === "body" && plain.runs === "1" && plain.before === "space" && plain.after === "space" && !plain.container.length, "a plain run: " + JSON.stringify(plain));
  const split = one(L.S["split across two runs, bold then plain"].body);
  ok(split.runs === "2" && split.formatting === "differs", "split across runs: " + JSON.stringify(split));
  ok(one(L.S["a tab between first and last name"].body).sep.includes("tab"), "a tab inside");
  ok(one(L.S["a table cell"].body).container.includes("table"), "a table cell");
  ok(one(L.S["a hyperlink"].body).container.includes("hyperlink"), "a hyperlink");
  ok(one(L.S["a field result"].body).container.includes("field result"), "a field result");
  ok(one(L.S["a tracked insertion"].body).container.includes("tracked insert"), "a tracked insertion");
  const tb = shapesOf(L.S["a text box, with its VML fallback"].body).filter((s) => !s.attr);
  ok(tb.length === 2 && tb.every((s) => s.container.includes("text box")), "a text box and its fallback: " + tb.length);
  const hf = L.S["a header and a footer"];
  ok(shapesOf(hf.body, hf.parts).some((s) => s.part === "header"), "a header");
  const fn = L.S["a footnote and an endnote"];
  ok(shapesOf(fn.body, fn.parts).some((s) => s.part === "footnote"), "a footnote");
  ok(shapesOf(L.S["a bookmark named after the person"].body).some((s) => s.attr === "bookmarkStart@name"), "a bookmark name, underscores and all");
  ok(shapesOf(L.S["a content control, with the name as its title"].body).some((s) => s.attr === "alias@val"), "a content-control title");
  const pr = L.S["the file's own properties"];
  ok(shapesOf(pr.body, pr.parts).some((s) => s.part === "properties" && s.element === "creator"), "the file's creator");
  const ch = L.S["a chart label"];
  ok(shapesOf(ch.body, ch.parts).some((s) => s.part === "chart"), "a chart");
}

console.log("\n— punctuation and prefixes around it —");
{
  const s = one(L.P(L.R(`המורה ולרחל פרידמן, אמרה.`)));
  ok(s.prefix === "ול" && s.before === "space" && s.after === ",", "two prefix letters and a comma: " + JSON.stringify(s));
  const q = one(L.P(L.R(`המורה ״${L.NAME}״ אמרה.`)));
  ok(q.before === "״" && q.after === "״", "gershayim on both sides");
  ok(!shapesOf(L.P(L.R("המורה ברחל פרידמנית אמרה."))).length, "a longer word is not an occurrence");
  // "במ" is not a pair Hebrew writes: a short name after it is the tail of another word
  ok(!H.harvest(H.unzip(Buffer.from(mkzip([...L.base, { name: "word/document.xml", body: L.doc(L.P(L.R("הלכנו במרן היום."))) }]))), ["רן"]).length, "a short name inside another word is not counted");
  const longest = H.harvest(H.unzip(Buffer.from(mkzip([...L.base, { name: "word/document.xml", body: L.doc(L.P(L.R("כתבתי ללבתיה אתמול."))) }]))), ["בתיה", "לבתיה", "ללבתיה"]);
  ok(longest.length === 1 && longest[0].prefix === "", "the longest listed surface wins: " + JSON.stringify(longest));
}

console.log("\n— the report never carries text —");
{
  let threw = false;
  try { H.guard({ x: "רחל" }); } catch (_) { threw = true; }
  ok(threw, "three Hebrew letters are refused");
  ok(H.guard({ prefix: "ול", before: "״" }), "two prefix letters and punctuation pass");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
