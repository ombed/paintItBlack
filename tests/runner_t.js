/* The runner itself (tests/run.js), over made-up suites (outside review, M7). A suite that
   prints a green tally and exits non-zero, a suite that reports fewer checks than its
   floor, and a suite that prints no tally must each fail the run. */
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-"));
const suite = (name, body) => { const p = path.join(dir, name); fs.writeFileSync(p, body); return p; };
const good = suite("good.js", 'console.log("5 passed, 0 failed");');
const liar = suite("liar.js", 'console.log("5 passed, 0 failed"); process.exitCode = 1;');
const small = suite("small.js", 'console.log("2 passed, 0 failed");');
const mute = suite("mute.js", 'console.log("nothing to see");');
const twice = suite("twice.js", 'console.log("1 passed, 0 failed"); console.log("9 passed, 0 failed");');
const floors = path.join(dir, "floors.json");
const run = (suites, fl) => { fs.writeFileSync(floors, JSON.stringify(fl)); return spawnSync(process.execPath, [path.join(__dirname, "run.js")], { encoding: "utf8", env: { ...process.env, PIB_SUITES: suites.join(","), PIB_FLOORS: floors } }); };

let r = run([good], { [good]: 5 });
ok(r.status === 0 && /5 passed, 0 failed, 0 could not run/.test(r.stdout), "a good suite at its floor passes: " + r.stdout.split("\n").slice(-3).join(" "));
r = run([good, liar], { [good]: 5, [liar]: 5 });
ok(r.status === 1 && /EXIT 1/.test(r.stdout), "a green tally with a non-zero exit fails the run");
r = run([small], { [small]: 3 });
ok(r.status === 1 && /SHRUNK/.test(r.stdout) && /fewer than its floor of 3/.test(r.stdout), "a suite below its floor fails the run");
r = run([mute], {});
ok(r.status === 1 && /reported no tally/.test(r.stdout), "a suite with no tally fails the run");
r = run([twice], { [twice]: 9 });
ok(r.status === 0 && /9 passed/.test(r.stdout), "the last tally a suite prints is the one that counts");
fs.rmSync(dir, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
