/* One licence, said the same way everywhere (outside review L14: three files named three). */
const fs = require("fs"), path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
ok(/PolyForm Shield License 1\.0\.0/.test(read("LICENSE")), "LICENSE is PolyForm Shield 1.0.0");
ok(JSON.parse(read("package.json")).license === "PolyForm-Shield-1.0.0", "package.json names the same licence, by its SPDX identifier");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
