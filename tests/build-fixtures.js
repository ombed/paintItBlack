/* Replaces extract.py.

   The suites were written against app.html, the vanilla single-file build,
   and slice the engine out of its one <script>. This repo splits engine and
   UI, so there is no app.html to slice. Rather than edit suites whose
   assertions encode bugs that took a while to find, this regenerates the
   shape they expect from redact-engine.js, which is byte-identical to the
   reference engine they were written against.

   The one subtlety is ordering. Each suite cuts the script at the UI
   divider, then re-appends spans that lived on the UI side of it in the
   vanilla build. pseudoRX is one such span for every suite: it sits inside
   the engine here, so it is moved back across the divider, or the generated
   core declares it twice and refuses to load.

   edge.js also appends js.slice(indexOf("const TITLE_RX="), indexOf("function
   peoAdd(")). That span used to be relocated too. It no longer can be:
   bodyNames and nerClean reference TITLE_RX, and a core built without it
   throws inside redactDocx's try and silently loses every suggestion, which
   is how the real-transcript tool lost its prose-only name. So the span
   stays in the body, the declaration is spelled with a space so edge.js's
   indexOf does not find it, and no peoAdd stub is emitted: both markers come
   back -1 and the appended slice is empty. */
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

const pseudoStart = find("function pseudoRX(p){");
const pseudoEnd = src.indexOf("\n}", pseudoStart) + 2;
const spanPseudo = src.slice(pseudoStart, pseudoEnd);
const engine = (src.slice(0, pseudoStart) + src.slice(pseudoEnd))
  .replace("const TITLE_RX=", "const TITLE_RX =");
if (engine.includes("const TITLE_RX=")) throw new Error("TITLE_RX marker still visible to edge.js");

// Take the divider from a suite rather than retyping 52 box-drawing chars.
const marker = (fs.readFileSync(path.join(HERE, "e2e.js"), "utf8")
  .match(/indexOf\('(\/\*[^']*ממשק[^']*\*\/)'\)/) || [])[1];
if (!marker) throw new Error("could not read the UI divider out of e2e.js");

fs.writeFileSync(path.join(HERE, "app.html"),
  '<!doctype html><meta charset="utf-8">\n<script>\n' + PRELUDE + engine +
  "\n" + marker + "\n" +
  spanPseudo + "\nfunction livePairs(){}\n" +
  "</script>\n", "utf8");

// core.js is required directly, never sliced, so it keeps the original order.
const exp = (fs.readFileSync(path.join(HERE, "extract.py"), "utf8")
  .match(/module\.exports=\{[^}]*\}/) || [])[0];
if (!exp) throw new Error("could not read the export list out of extract.py");
fs.writeFileSync(path.join(HERE, "core.js"), PRELUDE + src + "\n" + exp + ";\n", "utf8");

console.log("built tests/app.html and tests/core.js from redact-engine.js");
