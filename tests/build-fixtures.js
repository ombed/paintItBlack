/* Replaces extract.py.

   The suites were written against app.html, the vanilla single-file build,
   and slice the engine out of its one <script>. This repo splits engine and
   UI, so there is no app.html to slice. Rather than edit suites whose
   assertions encode bugs that took a while to find, this regenerates the
   shape they expect from redact-engine.js, which is byte-identical to the
   reference engine they were written against.

   The one subtlety is ordering. Each suite cuts the script at the UI
   divider, then re-appends spans that lived on the UI side of it in the
   vanilla build: pseudoRX (all of them) and TITLE_RX..peoAdd (edge.js).
   Both spans sit inside the engine here, so if they are left in place the
   generated core declares them twice and refuses to load. They are moved
   back across the divider, in the order the slices expect.

   Both spans are self-contained. Nothing above the divider references them,
   and their only outward reference is trimEdges, which stays above it. */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
let src = fs.readFileSync(path.join(HERE, "..", "redact-engine.js"), "utf8");

// ESM to plain script: the suites load this with require().
src = src.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, "");
src = src.replace(/^export\s*\{[\s\S]*?\};?[ \t]*$/gm, "");

/* extract.py sliced the vanilla script and so skipped the load-time call to
   nerFixRegExp, which touches window. Taking the whole engine keeps more
   coverage but pulls that call in, so the generated files open with the one
   global it needs. Guarded, because jsdom supplies the real one. */
const PRELUDE =
  'if (typeof globalThis.window === "undefined") globalThis.window = globalThis;\n';

const find = (needle) => {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error("not found in redact-engine.js: " + needle);
  return i;
};

const titleStart = find("const TITLE_RX=");
const pseudoStart = find("function pseudoRX(p){");
const pseudoEnd = src.indexOf("\n}", pseudoStart) + 2;
if (titleStart > pseudoStart) throw new Error("TITLE_RX is expected above pseudoRX");

const spanTitle = src.slice(titleStart, pseudoStart); // TITLE_RX, ORG_RX, likelyOrg, cleanEntry
const spanPseudo = src.slice(pseudoStart, pseudoEnd);
const engine = src.slice(0, titleStart) + src.slice(pseudoEnd);

// Take the divider from a suite rather than retyping 52 box-drawing chars.
const marker = (fs.readFileSync(path.join(HERE, "e2e.js"), "utf8")
  .match(/indexOf\('(\/\*[^']*\u05de\u05de\u05e9\u05e7[^']*\*\/)'\)/) || [])[1];
if (!marker) throw new Error("could not read the UI divider out of e2e.js");

fs.writeFileSync(path.join(HERE, "app.html"),
  '<!doctype html><meta charset="utf-8">\n<script>\n' + PRELUDE + engine +
  "\n" + marker + "\n" +
  spanPseudo + "\nfunction livePairs(){}\n" +
  spanTitle + "\nfunction peoAdd(){}\n" +
  "</script>\n", "utf8");

// core.js is required directly, never sliced, so it keeps the original order.
const exp = (fs.readFileSync(path.join(HERE, "extract.py"), "utf8")
  .match(/module\.exports=\{[^}]*\}/) || [])[0];
if (!exp) throw new Error("could not read the export list out of extract.py");
fs.writeFileSync(path.join(HERE, "core.js"), PRELUDE + src + "\n" + exp + ";\n", "utf8");

console.log("built tests/app.html and tests/core.js from redact-engine.js");
