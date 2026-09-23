/* Text is never dimmed with opacity (live smoke test of v54). The prefix letter of a marked name
   was drawn at opacity .5: 2.3:1 against the mark, under WCAG's 4.5:1, and axe never saw it
   because the a11y spec's document had no name with a prefix. Opacity blends text into its
   background; on this page's colours no opacity under about .9 keeps 4.5:1, so a lighter weight
   or a colour token does the dimming instead. The exceptions are controls that are disabled
   (WCAG exempts inactive components): the CSS for button:disabled and the undo/redo glyphs,
   which are dimmed only together with their disabled binding. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const cut = html.indexOf('type="text/x-dc"');
const template = html.slice(0, cut), app = html.slice(cut);
const DIM = /opacity:\s*0?\.\d+/;

// 1. a template element whose own style dims it, and which holds text or a {{ binding }}
const dimText = [...template.matchAll(/<([a-z][\w-]*)\b[^>]*\bstyle="([^"]*)"[^>]*>([^<]*)/g)]
  .filter((m) => DIM.test(m[2]) && m[3].trim())
  .map((m) => `<${m[1]}> ${m[3].trim().slice(0, 30)}`);
ok(dimText.length === 0, "no template text is dimmed with opacity: " + dimText.join(" · "));

// 2. style strings the app builds: every dimming opacity is one of the known disabled states
const ALLOWED = [
  /button:disabled\{opacity:\.55;/,                 // the page CSS: disabled buttons
  /\(on\?"":";opacity:\.4;cursor:default"\)/,       // histBtn: undo/redo with nothing to do
];
// per line: more dimming opacities than allowed ones is a finding
const unexplained = (text) => text.split("\n").map((l, i) => ({ l, i,
  n: (l.match(/opacity:\s*0?\.\d+/g) || []).length, a: ALLOWED.filter((rx) => rx.test(l)).length }))
  .filter((x) => x.n > x.a).map((x) => `line ${x.i + 1}: ${x.l.trim().slice(0, 70)}`);
const dims = unexplained(html);
ok(dims.length === 0, "every other opacity under 1 is a known disabled state: " + dims.join(" · "));
ok(unexplained('        (x.on?"":"opacity:.72"),').length === 1, "the check catches v54's dimmed place row");

// 3. the undo/redo glyphs are dimmed only when their button is disabled too
ok(/onClick="\{\{ onHistUndo \}\}" disabled="\{\{ undoOff \}\}"/.test(template), "the undo button is disabled when there is nothing to undo");
ok(/onClick="\{\{ onHistRedo \}\}" disabled="\{\{ redoOff \}\}"/.test(template), "the redo button is disabled when there is nothing to redo");
ok(/v\.undoOff=!\(\(S\.undoN\|\|0\)>0\); v\.redoOff=!\(\(S\.redoN\|\|0\)>0\);/.test(app), "undoOff and redoOff follow the same counts as the dim style");

// 4. the check itself bites: an invented template line with dimmed text is caught
const probe = '<span data-pre style="opacity:.5;font-weight:400">{{ sg.pre }}</span>';
ok([...probe.matchAll(/<([a-z][\w-]*)\b[^>]*\bstyle="([^"]*)"[^>]*>([^<]*)/g)].some((m) => DIM.test(m[2]) && m[3].trim()), "the check catches v54's prefix span");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
