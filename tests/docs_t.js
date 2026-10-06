/* What the texts say about the tool, read against the tool itself (the check of 6.10).

   The tour, the README, the two Hebrew guides, the issue form and package.json are what a new user,
   a careful reader or a client's IT goes by, and they had drifted from the tool:
   - a deleted value is drawn on the review screen as a dashed chip with an eraser; until 6.10 it was
     the text ∅, and the tour and the guides still described the ∅;
   - the README's network table left out React, which every first visit loads from unpkg;
   - the trial guide gave the model as about 130 MB, and placed the review screen's parts on sides
     they are not on (and on a phone they are two tabs, not sides);
   - the issue form named a button the tool does not have;
   - the model-evaluation docs spelled out one computer's folders, and package.json pointed at an SSH
     alias that resolves on one computer only.
   Where it can, each check takes the fact from the code, so a change to the code fails here until the
   texts follow it. */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
// comments are for developers and may tell the mark's history; "//" after ":" is a URL, not a comment
const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

console.log("\n— the texts name the deletion mark the review screen draws —");
{
  const html = read("index.html");
  ok(/<sc-if value="\{\{ sg\.del \}\}"><svg [^>]*data-icon="eraser"/.test(html), "a deleted value is drawn with the eraser");
  for (const [f, text] of [["index.html", strip(html)], ["docs/trial-guide-he.md", read("docs/trial-guide-he.md")], ["docs/answer-sheet-he.md", read("docs/answer-sheet-he.md")]]) {
    const left = (text.match(/∅/g) || []).length;
    ok(left === 0, `${f} describes the eraser, not ∅ (${left} left)`);
  }
}

console.log("\n— the network table names every library the tool loads from a CDN —");
{
  const md = read("README.md");
  const section = (md.split("## מה נטען מהרשת")[1] || "").split("\n## ")[0];
  const rows = section.split("\n").filter((l) => /^\| /.test(l) && !/^\| (?:מאיפה|---)/.test(l));
  ok(rows.length >= 2, "README.md has the network table: " + rows.length + " rows");
  const libs = [];
  // React and ReactDOM: every first visit, and every update (support.js; sw.js keeps them at install)
  const support = read("support.js");
  for (const [v, name] of [["REACT_URL", "React"], ["REACT_DOM_URL", "ReactDOM"]]) {
    const url = (support.match(new RegExp("var " + v + ' = "([^"]+)"')) || [])[1];
    ok(!!url, "support.js names " + v);
    if (url) libs.push({ name, url, version: true });
  }
  // the map's libraries, once the map is shown (index.html)
  const map = [...read("index.html").matchAll(/\["([\w-]+)","(https:\/\/[^"]+)","sha\d+-/g)];
  ok(map.length >= 2, "index.html names the map's libraries: " + map.map((m) => m[1]).join(", "));
  for (const m of map) libs.push({ name: m[1], url: m[2], version: false });
  for (const lib of libs) {
    const host = new URL(lib.url).hostname, ver = (lib.url.match(/@(\d+\.\d+\.\d+)/) || [])[1];
    const row = rows.find((r) => r.startsWith("| " + host + " |") && new RegExp("(?<![\\w-])" + lib.name + "(?![\\w-])").test(r));
    ok(!!row && (!lib.version || row.includes(ver)), `the table has a row for ${host} that names ${lib.name}${lib.version ? " " + ver : ""}`);
  }
}

console.log("\n— the model's size is the size of the files the site ships —");
{
  const dir = "models/dictabert-parse-ner-37f4d6f/onnx";
  const parts = fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.part\d+$/.test(f));
  const mb = Math.round(parts.reduce((a, f) => a + fs.statSync(path.join(ROOT, dir, f)).size, 0) / 1e6);
  ok(parts.length === 4 && mb > 100, `the model's ${parts.length} parts weigh ${mb} MB`);
  for (const f of ["README.md", "docs/trial-guide-he.md", "docs/answer-sheet-he.md", "index.html"]) {
    const said = [...read(f).matchAll(/(\d+)\s*(?:MB|מגה)(?![A-Za-z])/g)].map((m) => Number(m[1]));
    ok(said.length > 0 && said.every((n) => n === mb), `${f} gives the model's size as ${mb} MB: ${said.join(", ")}`);
  }
}

console.log("\n— the guides name the review screen's parts, not their side —");
// at 1280 the document is on the right and the findings on the left; on a phone they are two tabs
for (const f of ["docs/trial-guide-he.md", "docs/answer-sheet-he.md"]) {
  const sides = [...read(f).matchAll(/(?<![א-ת])(?:מימין|משמאל|בצד הימני|בצד השמאלי)(?![א-ת])/g)].map((m) => m[0]);
  ok(sides.length === 0, `${f} places nothing by its side: ${sides.join(", ")}`);
}

console.log("\n— the issue form names buttons the tool has —");
{
  const html = read("index.html");
  const dir = ".github/ISSUE_TEMPLATE";
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => /\.ya?ml$/.test(x))) {
    const named = [...read(dir + "/" + f).matchAll(/(?:הכפתור|לחצ[א-ת]*)\s+"([^"]+)"/g)].map((m) => m[1]);
    ok(named.length > 0, `${dir}/${f} names a button`);
    for (const n of named) ok(html.includes(">" + n + "<") || html.includes('"' + n + '"'), `${dir}/${f} names «${n}», a label index.html has`);
  }
}

console.log("\n— no text spells out one computer's folders —");
{
  let tracked = "";
  try { tracked = execSync('git ls-files -- docs bench .github "*.md"', { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (_) { /* the count below fails */ }
  const files = [...new Set(tracked.split("\n").filter((f) => /\.(?:md|txt|py|js|json|ya?ml|html)$/i.test(f)))];
  ok(files.length > 50, "git ls-files listed the docs: " + files.length + " text files; without it this check proves nothing");
  const local = /(?<![A-Za-z])[A-Za-z]:[\\/]+Users[\\/]|\/c\/Users\/|(?<![\w.-])Users[\\/]+Me(?![\w-])/i;
  const hits = files.filter((f) => local.test(read(f)));
  ok(hits.length === 0, "files with a local absolute path: " + hits.join(", "));
  // and package.json points at the repository's public address, not at one computer's SSH alias
  const repo = JSON.parse(read("package.json")).repository;
  ok(!!repo && repo.url === "https://github.com/ombed/inkognito", "package.json's repository is https://github.com/ombed/inkognito: " + (repo && repo.url));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
