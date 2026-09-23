/* The "pr" check (docs/QUALITY-PLAN.md, layer 6): a bug fix closes the class,
   not the instance.

   Reads a pull request description written from .github/pull_request_template.md
   and reports what is missing. Exactly one kind is ticked. A bug fix answers all
   three: the test for the case that was hit (a file under tests/ or e2e/), the
   class and what now covers it, and the probe across the siblings. Text inside
   <!-- --> is the template's own hint and does not count as an answer.

   CI passes the description in PR_BODY, through the environment and never
   through the shell, so nothing in it is executed. */

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "").trim();

// the text under a heading, up to the next heading of the same or a higher level
function section(body, title) {
  const lines = body.split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{2,3}\s/.test(l) && l.replace(/^#+\s*/, "").trim().toLowerCase().startsWith(title.toLowerCase()));
  if (at < 0) return null;
  const level = lines[at].match(/^#+/)[0].length;
  const out = [];
  for (const l of lines.slice(at + 1)) {
    const h = l.match(/^(#+)\s/);
    if (h && h[1].length <= level) break;
    out.push(l);
  }
  return out.join("\n");
}

function checkPr(body) {
  const problems = [];
  const b = String(body || "");
  const kind = section(b, "Kind");
  if (kind === null) return ["The description has no \"Kind\" section. Start it from .github/pull_request_template.md."];
  const ticked = (label) => new RegExp("^\\s*[-*]\\s*\\[[xX]\\]\\s*" + label, "m").test(kind);
  const bug = ticked("Bug fix"), other = ticked("Not a bug fix");
  if (bug === other) return ["Tick exactly one box under \"Kind\"."];
  if (!bug) return problems;

  const hit = section(b, "1. The case that was hit"), cls = section(b, "2. The class"), probe = section(b, "3. The probe");
  const hitText = hit === null ? "" : strip(hit);
  if (!hitText) problems.push("Bug fix: \"1. The case that was hit\" is empty. Name the test that fails without the fix.");
  else if (!/\b(?:tests|e2e)\/[\w.-]+\.js\b/.test(hitText)) problems.push("Bug fix: \"1. The case that was hit\" names no test file under tests/ or e2e/.");
  else {
    // every file it names is in the checkout (review M6): a made-up name passed before
    for (const f of new Set(hitText.match(/\b(?:tests|e2e)\/[\w.-]+\.js\b/g)))
      if (!fs.existsSync(path.join(ROOT, f))) problems.push(`Bug fix: "1. The case that was hit" names ${f}, which does not exist in this branch.`);
  }
  if (cls === null || !strip(cls)) problems.push("Bug fix: \"2. The class\" is empty. Say what the siblings share and what now covers them.");
  if (probe === null || !strip(probe)) problems.push("Bug fix: \"3. The probe\" is empty. Say what was tried beyond the case and what it found, \"nothing\" included.");
  return problems;
}

module.exports = { checkPr, section };

if (require.main === module) {
  const problems = checkPr(process.env.PR_BODY);
  if (problems.length) {
    for (const p of problems) console.log("✗ " + p);
    console.log("\nSee .github/pull_request_template.md and docs/QUALITY-PLAN.md, layer 6.");
    process.exit(1);
  }
  console.log("✓ the description answers what the template asks");
}
