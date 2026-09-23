/* scripts/diff-runtime.js: a candidate path that does not exist is reported in one line
   with exit code 2, not an unhandled ENOENT stack (outside review, nit 9). And a real
   candidate, here the vendored file itself, still compares as identical. */
const path = require("path");
const { spawnSync } = require("child_process");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ROOT = path.join(__dirname, "..");
const run = (...args) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "diff-runtime.js"), ...args], { cwd: ROOT, encoding: "utf8" });

console.log("\n— a path that does not exist —");
{
  const r = run(path.join(ROOT, "no-such-dir", "support.js"));
  ok(r.status === 2, "exit code 2, got " + r.status);
  ok(/no such file: /.test(r.stderr), "a one-line message: " + r.stderr.trim().split("\n")[0]);
  ok(!/ENOENT|\n\s+at /.test(r.stderr), "no unhandled error stack");
}

console.log("\n— a directory is not a candidate either —");
{
  const r = run(path.join(ROOT, "scripts"));
  ok(r.status === 2 && /no such file: /.test(r.stderr), "exit code 2 and the message, got " + r.status);
}

console.log("\n— the vendored file against itself —");
{
  const r = run(path.join(ROOT, "support.js"));
  ok(r.status === 0 && /identical/.test(r.stdout), "identical, exit 0");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
