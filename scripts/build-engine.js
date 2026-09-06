/* redact-engine.js is generated:  node scripts/build-engine.js

   The engine is edited as the files under engine/, one per section, in the
   order their names sort. This concatenates them, byte for byte, into the
   single file the page, the tests and the benchmark load. tests/engine_t.js
   fails when the generated file is stale, so an edit to redact-engine.js by
   hand is caught the next time the suite runs.

   --split does the reverse once: cuts the current redact-engine.js at its
   section banners into engine/. It was used to create the layout and is
   kept so the split can be redone if a banner moves. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "engine");
const OUT = path.join(ROOT, "redact-engine.js");

function build() {
  const parts = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  if (!parts.length) throw new Error("engine/ is empty");
  return parts.map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("");
}

function split() {
  const src = fs.readFileSync(OUT, "utf8");
  const NL = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = src.split(NL);
  // a banner is a comment line opening with box-drawing bars; its title names the file
  const NAMES = { "XML": "xml", "עברית": "hebrew", "שמות חלופיים": "fakenames", "שיבושי תמלול": "nearmiss",
    "שמות בגוף הטקסט": "bodynames", "שכבת זיהוי": "model", "מנוע": "engine", "DOCX": "docx" };
  const cuts = [];
  lines.forEach((l, i) => { if (/^\/\* ═+/.test(l)) cuts.push(i); });
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) if (/^\d\d-.*\.js$/.test(f)) fs.unlinkSync(path.join(DIR, f));
  const bounds = [0, ...cuts, lines.length];
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = lines.slice(bounds[k], bounds[k + 1]);
    const head = k === 0 ? "head" : (Object.entries(NAMES).find(([t]) => lines[bounds[k]].includes(t)) || [null, "part" + k])[1];
    const name = String(k).padStart(2, "0") + "-" + head + ".js";
    const text = chunk.join(NL) + (k === bounds.length - 2 ? "" : NL);
    fs.writeFileSync(path.join(DIR, name), text);
    console.log("  " + name.padEnd(18) + chunk.length + " lines");
  }
}

if (require.main === module) {
  if (process.argv.includes("--split")) { split(); console.log("split redact-engine.js into engine/"); }
  else { fs.writeFileSync(OUT, build()); console.log("wrote redact-engine.js from engine/"); }
}
module.exports = { build, OUT, DIR };
