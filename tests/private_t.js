/* Nothing private is tracked, and the private folder is outside the tree.

   Real documents from real sessions are the regression set that the synthetic
   corpus cannot replace, and they can never be published. bench/private.js
   reads them from a sibling folder of the repository. This checks the two
   properties that keep that true:

     1. no tracked path looks like a private fixture, under any name;
     2. the resolved private folder is outside the repository root, so a
        forced add cannot reach it, whatever PRIVATE_BENCH says.

   It also checks that the loader tolerates the folder being absent, which is
   the state on every machine but yours, including CI. */
const { execSync } = require("child_process");
const path = require("path");
const PRIVATE = require("../bench/private.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— nothing private is tracked —");
{
  let tracked = "";
  try { tracked = execSync("git ls-files", { cwd: PRIVATE.ROOT, encoding: "utf8" }); } catch (_) { tracked = ""; }
  const bad = tracked.split("\n").filter((f) => /private-bench|bench\/private\/|private-fixture|real-use|r\d+-interview/i.test(f));
  ok(bad.length === 0, "tracked paths that look private: " + JSON.stringify(bad));
}

console.log("\n— the private folder resolves outside the repository —");
{
  ok(PRIVATE.outsideRepo(PRIVATE.dir()), "default folder is outside: " + PRIVATE.dir());
  ok(!PRIVATE.outsideRepo(path.join(PRIVATE.ROOT, "bench", "private")), "a folder inside the tree is recognised as inside");
  ok(PRIVATE.outsideRepo(path.resolve(PRIVATE.ROOT, "..", "elsewhere")), "a sibling folder is recognised as outside");
}

console.log("\n— absent folder is not an error —");
{
  const saved = process.env.PRIVATE_BENCH;
  process.env.PRIVATE_BENCH = path.resolve(PRIVATE.ROOT, "..", "no-such-private-folder-" + Date.now());
  let res = null, threw = false;
  try { res = PRIVATE.load(); } catch (_) { threw = true; }
  ok(!threw && res && res.docs.length === 0, "an absent folder yields an empty list without throwing");
  if (saved === undefined) delete process.env.PRIVATE_BENCH; else process.env.PRIVATE_BENCH = saved;
}

console.log("\n— a folder inside the tree is refused —");
{
  const saved = process.env.PRIVATE_BENCH;
  process.env.PRIVATE_BENCH = path.join(PRIVATE.ROOT, "bench", "corpus"); // exists, and is inside
  let threw = false;
  try { PRIVATE.load(); } catch (_) { threw = true; }
  ok(threw, "pointing the loader inside the repository throws");
  if (saved === undefined) delete process.env.PRIVATE_BENCH; else process.env.PRIVATE_BENCH = saved;
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
