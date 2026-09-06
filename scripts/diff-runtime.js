/* support.js is a vendored build of dc-runtime, the template runtime the
   page renders with. It has no version of its own, so this records what we
   know and compares against a newer copy when one arrives:

     node scripts/diff-runtime.js path/to/new/support.js

   Prints the size and hash of both and the first differing lines. Replace
   the file only after the browser suite is green against the new copy. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HERE = path.join(__dirname, "..", "support.js");
const OTHER = process.argv[2];
const info = (p) => { const s = fs.readFileSync(p, "utf8"); return { s, lines: s.split(/\r?\n/).length, hash: crypto.createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16) }; };
const a = info(HERE);
console.log(`vendored support.js: ${a.lines} lines, sha256 ${a.hash}`);
console.log(`origin: dc-runtime (Claude Design), generated build, first vendored 2026-09-04 with the redesign (commit cf934f4)`);
if (!OTHER) process.exit(0);
const b = info(OTHER);
console.log(`candidate:           ${b.lines} lines, sha256 ${b.hash}`);
if (a.hash === b.hash) { console.log("identical"); process.exit(0); }
const A = a.s.split(/\r?\n/), B = b.s.split(/\r?\n/);
let shown = 0;
for (let i = 0; i < Math.max(A.length, B.length) && shown < 12; i++) if (A[i] !== B[i]) { console.log(`  line ${i + 1}\n    ours:  ${(A[i] || "").slice(0, 100)}\n    theirs: ${(B[i] || "").slice(0, 100)}`); shown++; }
