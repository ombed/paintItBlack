/* The version string lives in six places. All six must agree, or the chip
   on a phone shows the old number next to a "refresh without cache" warning
   that never goes away. scripts/bump.js writes them; this reads them back.

   A version is "v73", or "v73.1" for a small fix of v73 (the owner, 9.10.2026: a new version only
   after a batch of improvements; a small fix stays the same version for users). The second half
   runs scripts/bump.js on a scratch copy of the three files, never on the real ones. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (f, root = ROOT) => fs.readFileSync(path.join(root, f), "utf8");

let pass = 0, fail = 0;
const eq = (what, a, b) => { if (a === b) pass++; else { fail++; console.log("  FAIL " + what + ": " + a + " ≠ " + b); } };
const V = "v\\d+(?:\\.\\d+)?";

function agree(root, label) {
  const html = read("index.html", root), sw = read("sw.js", root), md = read("README.md", root);
  const pick = (s, rx, what) => { const m = s.match(rx); if (!m) { fail++; console.log("  FAIL missing (" + label + "): " + what); return null; } return m[1]; };
  const chip = pick(html, new RegExp('<div id="ver">גרסה (' + V + ")</div>"), "chip");
  const log = pick(html, new RegExp('console\\.log\\("אינקוגניטו — גרסה (' + V + ')"\\)'), "console line");
  const served = pick(html, new RegExp('if\\(served==="(' + V + ')"\\) return;'), "served check");
  const warn = pick(html, new RegExp("el\\.innerHTML='גרסה (" + V + ") · "), "warning label");
  const key = pick(sw, new RegExp('const V="hedact-(' + V + ')";'), "sw cache key");
  const readme = pick(md, new RegExp("מספרי השורות נכונים לגרסה (" + V + ")"), "README note");
  eq(label + ": console line = chip", log, chip);
  eq(label + ": served check = chip", served, chip);
  eq(label + ": warning label = chip", warn, chip);
  eq(label + ": sw cache key = chip", key, chip);
  eq(label + ": README = chip", readme, chip);
  // the README table mentions no other version
  const others = [...md.matchAll(new RegExp("`[^`]*\\b(" + V + ")\\b[^`]*`", "g"))].map((m) => m[1]).filter((v) => v !== chip);
  eq(label + ": README table has no stray version", others.join(","), "");
  // and the line numbers in the table point at the right lines
  const lines = html.split("\n");
  for (const m of md.matchAll(/^\| `index\.html` \| (\d+) \| `([^`]+)`/gm)) {
    const n = Number(m[1]); const needle = m[2].replace(/…/g, "");
    const key2 = needle.includes('id="ver"') ? '<div id="ver">' : needle.includes("console") ? "console.log(" : needle.includes("served") ? "if(served===" : "el.innerHTML='גרסה";
    eq(label + ": README line " + n + " holds " + key2, (lines[n - 1] || "").includes(key2), true);
  }
  return chip;
}

const chip = agree(ROOT, "repo");
eq("the version is a version", new RegExp("^" + V + "$").test(chip || ""), true);

// bump.js on a scratch copy: a fix, another fix, a release, and the refusals
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bump-"));
try {
  fs.mkdirSync(path.join(tmp, "scripts"));
  fs.copyFileSync(path.join(ROOT, "scripts", "bump.js"), path.join(tmp, "scripts", "bump.js"));
  for (const f of ["index.html", "sw.js", "README.md"]) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  const bump = (...a) => { try { execFileSync(process.execPath, [path.join(tmp, "scripts", "bump.js"), ...a], { stdio: "pipe" }); return 0; } catch (e) { return e.status || 1; } };
  const n = Number(chip.match(/^v(\d+)/)[1]), k = Number((chip.match(/\.(\d+)$/) || [0, 0])[1]);
  eq("fix: exits 0", bump("fix"), 0);
  eq("fix: the next small fix", agree(tmp, "after fix"), "v" + n + "." + (k + 1));
  eq("another fix: exits 0", bump("fix"), 0);
  eq("another fix: one more", agree(tmp, "after second fix"), "v" + n + "." + (k + 2));
  eq("an older version is refused", bump(String(n)), 2);
  eq("a release: exits 0", bump(String(n + 1)), 0);
  eq("a release has no fix number", agree(tmp, "after release"), "v" + (n + 1));
  eq("a fix after a release starts at .1", bump("fix") === 0 && agree(tmp, "after release fix"), "v" + (n + 1) + ".1");
  eq("an explicit fix number that is not newer is refused", bump((n + 1) + ".1"), 2);
  eq("a .0 is not a version", bump((n + 2) + ".0"), 2);
  eq("no argument is a usage error", bump(), 2);
  eq("the real files are untouched", read("index.html").includes('<div id="ver">גרסה ' + chip + "</div>"), true);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
