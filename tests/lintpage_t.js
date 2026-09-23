/* index.html is linted (outside review, M5). The review injected an undefined name into
   selfCheck and eslint, and every suite, stayed green. */
const fs = require("fs");
const path = require("path");
const { lintPage, blocks } = require("../scripts/lint-page.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

(async () => {
  const b = blocks(html);
  ok(b.some((x) => x.app) && b.length >= 2, "the app block and the inline scripts are found: " + b.length);
  const clean = (await lintPage(html)).filter((p) => p.severity === 2);
  ok(clean.length === 0, "the page as it is lints clean: " + JSON.stringify(clean.slice(0, 3)));

  const a = "  selfCheck(verbose){";
  ok(html.split(a).length === 2, "selfCheck is where the review injected");
  const bad = html.replace(a, a + "\n    if(false) thisNameDoesNotExistAnywhere();");
  const line = bad.split("\n").findIndex((l) => l.includes("thisNameDoesNotExistAnywhere")) + 1;
  const found = (await lintPage(bad)).filter((p) => p.severity === 2);
  ok(found.some((p) => p.rule === "no-undef" && p.line === line), `the injected undefined name is an error at index.html:${line}: ` + JSON.stringify(found.slice(0, 3)));

  const inline = html.replace("<script>/*", "<script>undefinedInHead();/*");
  ok((await lintPage(inline)).some((p) => p.rule === "no-undef" && p.line === 15), "an inline head script is linted too");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
