/* A backslash lost on its way into a file is this repo's most repeated bug.
   `/s+/` instead of `/\s+/` is valid JavaScript, so neither the linter nor the
   type checker sees it; it silently matches the letter s, and in Hebrew source
   that means the expression never matches anything. It has cost, so far: the
   grouper's punctuation class, a public-body context check, the model's
   single-word test, and the speaker-line anchor, which never fired at all —
   including on the client's real transcripts, where it was written for.

   This looks for character classes that are almost certainly a lost backslash.
   A real intent to match the letter s next to + is vanishingly rare here; if
   one is ever needed, write it as [s]+ and this passes. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const FILES = ["redact-engine.js", "page-logic.js", "pdf-text.js", "text-to-docx.js", "sw.js", "index.html"]
  .concat(fs.readdirSync(path.join(ROOT, "engine")).filter((f) => f.endsWith(".js")).map((f) => "engine/" + f));

// each: the broken form, and what it was meant to be
const SUSPECT = [
  [/\/s\+\//g, "/\\s+/"],
  [/\/s\*\//g, "/\\s*/"],
  [/\/\^s/g, "/^\\s"],
  [/\[\^s\]/g, "[^\\s]"],
  [/\.split\(\/n\//g, ".split(/\\n/)"],
  [/\/d\{/g, "/\\d{"],
  [/\(\/w\+\//g, "(/\\w+/"],
];

let pass = 0, fail = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  let clean = true;
  for (const [rx, meant] of SUSPECT) {
    rx.lastIndex = 0;
    const hits = src.match(rx);
    if (hits) {
      clean = false; fail++;
      const line = src.slice(0, src.search(rx)).split(/\r?\n/).length;
      console.log(`  FAIL ${f}:${line} has ${hits[0]} — a lost backslash, meant ${meant}`);
    }
  }
  if (clean) pass++;
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
