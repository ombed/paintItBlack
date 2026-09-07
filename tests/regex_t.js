/* Two ways a Hebrew regex dies quietly, both of them valid JavaScript that no
   linter flags. This file looks for the shape of each in every shipped file.

   One: a backslash lost on its way into a file, this repo's most repeated bug.
   `/s+/` instead of `/\s+/` is valid JavaScript, so neither the linter nor the
   type checker sees it; it silently matches the letter s, and in Hebrew source
   that means the expression never matches anything. It has cost, so far: the
   grouper's punctuation class, a public-body context check, the model's
   single-word test, and the speaker-line anchor, which never fired at all —
   including on the client's real transcripts, where it was written for.

   The first scan looks for character classes that are almost certainly a lost
   backslash. A real intent to match the letter s next to + is vanishingly rare
   here; if one is ever needed, write it as [s]+ and this passes.

   Two: an optional suffix hung on a root that ends in a final letter. Hebrew
   writes kaf, mem, nun, pe and tsadi differently at the end of a word, so a
   root spelled with the final form cannot carry an inflection — the letter
   turns medial the moment a suffix arrives. An optional group after it is
   therefore dead: it can never match, and the anchor silently covers only the
   masculine singular. Two role words in the anchor list were written this way,
   and neither the feminine defendant nor the feminine minor was ever anchored.
   The second scan flags a final letter followed by an optional group whose
   alternatives begin with a Hebrew letter, or by a single Hebrew letter made
   optional. The fix is always to spell the inflections out, longest first.
   A comment describing the trap should quote it in words, not in the literal
   form, or it trips this scan itself. */
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

const HEBREW = /[א-ת]/;
// a final letter and then an optional group. Only a group of Hebrew suffixes is
// dead; one of punctuation or whitespace after a final letter is ordinary.
const DEAD_GROUP = /[ךםןףץ]\(\?:([^)]*)\)\??/g;
// a final letter and then one Hebrew letter made optional, the short spelling
// of the same mistake.
const DEAD_QUANT = /[ךםןףץ][א-ת]\?/g;
function deadSuffixes(src) {
  const out = [];
  let m;
  DEAD_GROUP.lastIndex = 0;
  while ((m = DEAD_GROUP.exec(src))) {
    if (m[1].split("|").some((a) => HEBREW.test(a[0] || ""))) out.push([m.index, m[0]]);
  }
  DEAD_QUANT.lastIndex = 0;
  while ((m = DEAD_QUANT.exec(src))) out.push([m.index, m[0]]);
  return out;
}

let pass = 0, fail = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  let clean = true;
  for (const [at, hit] of deadSuffixes(src)) {
    clean = false; fail++;
    const line = src.slice(0, at).split(/\r?\n/).length;
    console.log(`  FAIL ${f}:${line} has ${hit} — a suffix on a final letter, dead code; spell the inflections out`);
  }
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
