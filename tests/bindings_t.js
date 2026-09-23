/* Dead view bindings (outside review, L9). onAiGo and onAiCopy were built on every render and
   bound by no template line: a second restore path, with its own pair-building (livePairs) that
   did not drop merged or blacked-out values, sat in the code as if it were live. Every
   `v.name =` the view assigns must be read by the template, as `{{ name }}` or `{{ name.x }}`. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = html.slice(html.indexOf('type="text/x-dc"'));
const template = html.slice(0, html.indexOf('type="text/x-dc"'));
const assigned = new Set([...app.matchAll(/\bv\.([A-Za-z_]\w*)\s*=(?!=)/g)].map((m) => m[1]));
const bound = new Set([...template.matchAll(/\{\{\s*([A-Za-z_]\w*)/g)].map((m) => m[1]));
const dead = [...assigned].filter((k) => !bound.has(k));
ok(assigned.size > 20, "the view's assignments are found: " + assigned.size);
ok(dead.length === 0, "every v.<name> the view sets is read by the template; not read: " + dead.join(", "));

// review M17: a rule is built in one place, mkRule, so every rule has the same fields
// (the argument handed to mkRule, and mkRule's own parameter list and return, are the factory itself)
const literals = [...app.matchAll(/(?<!mkRule\()\{value[:,][^}]*replacement/g)].map((m) => m[0].slice(0, 60)).filter((s) => !s.startsWith("{value:String(value)"));
ok(literals.length === 0, "rules are built by mkRule only; literal rules found: " + JSON.stringify(literals));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
