/* npm run report. Runs the three measurement tools in tests/README's words:
   they print a report, they do not score, so nothing here passes or fails
   except the tools themselves crashing.

   real.js is the reason this command exists. It runs the actual Knesset
   transcript end to end, the closest thing to a regression check on real
   data, and things that are never run rot. It is also where the second
   spelling of a name, שלווה next to שלוה, shows up as flagged for review,
   which is the case the tool was built for. */
const { spawnSync } = require("child_process");
const path = require("path");

const HERE = __dirname;
const TOOLS = ["gap.js", "real.js", "perf.js"];

const build = spawnSync(process.execPath, ["build-fixtures.js"], { cwd: HERE, encoding: "utf8" });
if (build.status !== 0) { process.stderr.write(build.stderr || build.stdout || ""); process.exit(1); }

let failed = 0;
for (const tool of TOOLS) {
  const line = "═".repeat(12) + " " + tool + " " + "═".repeat(Math.max(0, 50 - tool.length));
  console.log("\n" + line);
  const r = spawnSync(process.execPath, [tool], { cwd: HERE, stdio: "inherit" });
  if (r.status !== 0) { failed++; console.log(`\n${tool} exited ${r.status}`); }
}
console.log("\n" + (failed ? `${failed} tool(s) crashed` : "all three tools ran") + "\n");
process.exit(failed ? 1 : 0);
