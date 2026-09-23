/* scripts/complexity.js, the committed command behind the brief's complexity numbers
   (outside review, H15). The first list was typed from a run that skipped a file it
   could not parse and so left out redactDocx. Here: the function that builds the
   download is measured, the app script inside index.html is measured, and a file
   that does not parse is an error rather than a silent skip. */
const path = require("path");
const { measure, sources, appScript } = require("../scripts/complexity.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— the repository as it is —");
{
  const { fns } = measure(sources(path.join(__dirname, "..")));
  const names = fns.map((x) => x.name);
  ok(names.some((n) => /'redactDocx'/.test(n)), "redactDocx is in the list");
  ok(names.some((n) => /'bodyNames'/.test(n)), "bodyNames is in the list");
  ok(fns.some((x) => x.file.startsWith("index.html")), "the app script inside index.html is measured");
  ok(fns.every((x, i) => i === 0 || fns[i - 1].value >= x.value), "sorted by value, highest first");
}

console.log("\n— a file that does not parse is an error, not a skip —");
{
  let err = null;
  try { measure([{ file: "broken.js", code: "function f( {", sourceType: "script" }]); } catch (e) { err = e; }
  ok(err && /broken\.js: does not parse/.test(err.message), "throws naming the file: " + (err && err.message));
}

console.log("\n— a made-up function over the limit is counted —");
{
  const branches = Array.from({ length: 14 }, (_, i) => `if(x===${i})y++;`).join("");
  const { fns, deep } = measure([{ file: "made-up.js", code: `function busy(x){let y=0;${branches}return y}\nfunction calm(x){return x}`, sourceType: "script" }]);
  ok(fns.length === 1 && /'busy'/.test(fns[0].name) && fns[0].value === 15, "busy at 15, calm not listed: " + JSON.stringify(fns));
  ok(deep["made-up.js"] === 0, "no deep nesting");
}

console.log("\n— the app script is cut from its script tag —");
{
  const s = appScript('<p>x</p><script type="text/x-dc" data-a="1">let a=1;</script><script>b()</script>');
  ok(s.includes("let a=1;") && !s.includes("b()"), "only the text/x-dc block");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
