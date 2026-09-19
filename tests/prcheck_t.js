/* The "pr" check (scripts/check-pr.js, docs/QUALITY-PLAN.md layer 6).

   Every case starts from the real .github/pull_request_template.md, so the
   template and the check cannot drift apart: the untouched template must fail,
   and filling it in as the template asks must pass. */
const fs = require("fs");
const path = require("path");
const { checkPr } = require("../scripts/check-pr.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const T = fs.readFileSync(path.join(__dirname, "..", ".github", "pull_request_template.md"), "utf8");

const tick = (body, label) => body.replace("- [ ] " + label, "- [x] " + label);
const answer = (body, heading, text) => {
  const i = body.indexOf(heading);
  if (i < 0) throw new Error("template lost its heading: " + heading);
  const end = body.indexOf("-->", i) + 3;
  return body.slice(0, end) + "\n" + text + body.slice(end);
};
const full = () => {
  let b = tick(T, "Bug fix");
  b = answer(b, "### 1. The case that was hit", 'e2e/unruly.spec.js "a tooltip opened while the screen rises ends on its word"');
  b = answer(b, "### 2. The class", "Any punctuation around a value. tests/shapes_t.js writes each value in 31 shapes.");
  b = answer(b, "### 3. The probe", "The 31 shapes on names, organisations and numbers; found footnote digits and glued numbers.");
  return b;
};

console.log("\n— the template as it comes —");
{
  const p = checkPr(T);
  ok(p.length === 1 && /exactly one/.test(p[0]), "nothing ticked fails: " + JSON.stringify(p));
  ok(/<!--/.test(T) && /### 1\. The case that was hit/.test(T), "the template carries the three headings and its hints");
}

console.log("\n— kind —");
{
  ok(checkPr(tick(T, "Not a bug fix")).length === 0, "not a bug fix passes with the rest empty");
  ok(checkPr(tick(tick(T, "Bug fix"), "Not a bug fix")).length === 1, "both ticked fails");
  ok(checkPr(tick(T, "Not a bug fix").replace("- [x]", "- [X]")).length === 0, "an upper-case X counts");
  ok(/no "Kind" section/.test(checkPr("Fixes the tour.")[0]), "a description not from the template is told where to start");
  ok(/no "Kind" section/.test(checkPr(undefined)[0]), "an empty description fails");
}

console.log("\n— a bug fix answers all three —");
{
  ok(checkPr(full()).length === 0, "all three answered passes: " + JSON.stringify(checkPr(full())));
  const empty = checkPr(tick(T, "Bug fix"));
  ok(empty.length === 3, "a bug fix with only the hints fails three times: " + JSON.stringify(empty));
  const noFile = full().replace('e2e/unruly.spec.js "a tooltip opened while the screen rises ends on its word"', "the quote test");
  ok(checkPr(noFile).some((p) => /names no test file/.test(p)), "the case must name a test file");
  const noProbe = full().replace("The 31 shapes on names, organisations and numbers; found footnote digits and glued numbers.", "");
  ok(checkPr(noProbe).some((p) => /The probe/.test(p)), "an empty probe fails");
  ok(checkPr(noProbe).length === 1, "and only the probe is reported");
  const hidden = full().replace("Any punctuation around a value. tests/shapes_t.js writes each value in 31 shapes.", "<!-- later -->");
  ok(checkPr(hidden).some((p) => /The class/.test(p)), "an answer hidden in a comment does not count");
  ok(checkPr(full().replace(/\n/g, "\r\n")).length === 0, "Windows line ends are read the same");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
